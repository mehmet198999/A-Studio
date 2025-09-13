import os
from typing import Generator, List

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from .tasks import enqueue_feature_job, job_db

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

connect_args: dict[str, object] = {}
engine_kwargs: dict[str, object] = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    if DATABASE_URL in ("sqlite://", "sqlite:///:memory:"):
        engine_kwargs["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    repo = Column(String)
    stack = Column(String)


Base.metadata.create_all(bind=engine)


class ProjectSchema(BaseModel):
    id: int | None = None
    name: str
    repo: str
    stack: str

    model_config = ConfigDict(from_attributes=True)


class FeatureRequest(BaseModel):
    prompt: str
    type: str


class JobStatus(BaseModel):
    id: str
    prompt: str
    type: str
    status: str
    logs: list[str]
    score: int | None = None
    preview_url: str | None = None
    branch_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str
    password: str


AUTH_TOKEN = os.environ.get("AUTH_TOKEN", "secret-token")


def verify_token(authorization: str | None = Header(default=None)) -> None:
    expected = f"Bearer {AUTH_TOKEN}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing token",
        )


app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/token")
async def login(data: LoginRequest) -> dict[str, str]:
    if data.username == "admin" and data.password == "secret":
        return {"access_token": AUTH_TOKEN}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@app.post("/projects", response_model=ProjectSchema, dependencies=[Depends(verify_token)])
async def create_project(project: ProjectSchema, db: Session = Depends(get_db)) -> ProjectSchema:
    db_project = Project(**project.model_dump(exclude={"id"}))
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return ProjectSchema.model_validate(db_project)


@app.get("/projects", response_model=List[ProjectSchema], dependencies=[Depends(verify_token)])
async def list_projects(db: Session = Depends(get_db)) -> List[ProjectSchema]:
    projects = db.query(Project).all()
    return [ProjectSchema.model_validate(p) for p in projects]


@app.get("/projects/{project_id}", response_model=ProjectSchema, dependencies=[Depends(verify_token)])
async def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectSchema:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectSchema.model_validate(project)


@app.put("/projects/{project_id}", response_model=ProjectSchema, dependencies=[Depends(verify_token)])
async def update_project(project_id: int, data: ProjectSchema, db: Session = Depends(get_db)) -> ProjectSchema:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in data.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return ProjectSchema.model_validate(project)


@app.delete("/projects/{project_id}", dependencies=[Depends(verify_token)])
async def delete_project(project_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"status": "deleted"}


@app.post("/jobs", dependencies=[Depends(verify_token)])
async def start_job(req: FeatureRequest) -> dict[str, str]:
    job_id = enqueue_feature_job(req.prompt, req.type)
    return {"job_id": job_id}


@app.get("/jobs", response_model=List[JobStatus], dependencies=[Depends(verify_token)])
async def list_jobs() -> List[JobStatus]:
    return [JobStatus(id=job_id, **data) for job_id, data in job_db.items()]


@app.get("/jobs/{job_id}", response_model=JobStatus, dependencies=[Depends(verify_token)])
async def get_job_status(job_id: str) -> JobStatus:
    data = job_db.get(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(id=job_id, **data)


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request, db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return templates.TemplateResponse("index.html", {"request": request, "projects": projects})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
