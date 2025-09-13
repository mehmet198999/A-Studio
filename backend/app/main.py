#<<<<<<< codex/add-fastapi-dependency-for-token-check

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    status,
)
=======
from fastapi import FastAPI, Request


import os
from fastapi import Depends, FastAPI, Request
#>>>>>>> main
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

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

#<<<<<<< codex/implement-enqueue_feature_job-function
from .tasks import enqueue_feature_job, job_db

app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")
#=======
#>>>>>>> main

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    repo = Column(String)
    stack = Column(String)


Base.metadata.create_all(bind=engine)

class Project(BaseModel):

class ProjectSchema(BaseModel):
    name: str
    repo: str
    stack: str

#<<<<<<< codex/add-fastapi-dependency-for-token-check

class LoginRequest(BaseModel):
    username: str
    password: str
=======
#<<<<<<< codex/implement-enqueue_feature_job-function
#=======
    model_config = ConfigDict(from_attributes=True)


app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
#>>>>>>> main

class FeatureRequest(BaseModel):
    prompt: str
    type: str

#<<<<<<< codex/implement-enqueue_feature_job-function

class JobStatus(BaseModel):
    status: str
    logs: list[str]
#>>>>>>> main

# In-memory store for demo purposes
projects: list[Project] = []

#<<<<<<< codex/add-fastapi-dependency-for-token-check
FAKE_TOKEN = "secret-token"


def verify_token(authorization: str | None = Header(default=None)) -> None:
    """Simple token verification dependency."""
    expected = f"Bearer {FAKE_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")


#=======
#>>>>>>> main
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request, db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return templates.TemplateResponse("index.html", {"request": request, "projects": projects})
#<<<<<<< codex/add-fastapi-dependency-for-token-check
#=======


#>>>>>>> main
@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


#<<<<<<< codex/add-fastapi-dependency-for-token-check
@app.post("/token")
async def login(data: LoginRequest) -> dict[str, str]:
    if data.username == "admin" and data.password == "secret":
        return {"access_token": FAKE_TOKEN}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

@app.post("/projects", response_model=Project, dependencies=[Depends(verify_token)])
#=======

@app.post("/projects", response_model=Project)
#>>>>>>> main
async def create_project(project: Project) -> Project:
    projects.append(project)
    return project

#<<<<<<< codex/add-fastapi-dependency-for-token-check
@app.get("/projects", response_model=list[Project], dependencies=[Depends(verify_token)])
#=======



#<<<<<<< codex/implement-enqueue_feature_job-function
@app.get("/projects", response_model=list[Project])
#>>>>>>> main
async def list_projects() -> list[Project]:
    return projects


@app.post("/jobs")
async def start_job(req: FeatureRequest) -> dict[str, str]:
    job_id = enqueue_feature_job(req.prompt, req.type)
    return {"job_id": job_id}


@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str) -> JobStatus:
    data = job_db.get(job_id)
    if not data:
        return JobStatus(status="not_found", logs=[])
    return JobStatus(**data)
#=======
@app.post("/projects", response_model=ProjectSchema)
async def create_project(project: ProjectSchema, db: Session = Depends(get_db)) -> ProjectSchema:
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return ProjectSchema.model_validate(db_project)


@app.get("/projects", response_model=list[ProjectSchema])
async def list_projects(db: Session = Depends(get_db)) -> list[ProjectSchema]:
    projects = db.query(Project).all()
    return [ProjectSchema.model_validate(p) for p in projects]
#>>>>>>> main
