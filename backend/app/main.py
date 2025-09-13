
import os
from fastapi import Depends, FastAPI, Request
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


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    repo = Column(String)
    stack = Column(String)


Base.metadata.create_all(bind=engine)


class ProjectSchema(BaseModel):
    name: str
    repo: str
    stack: str

    model_config = ConfigDict(from_attributes=True)


app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request, db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return templates.TemplateResponse("index.html", {"request": request, "projects": projects})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


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
