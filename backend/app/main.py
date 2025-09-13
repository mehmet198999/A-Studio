
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from .tasks import enqueue_feature_job, job_db

app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")



class Project(BaseModel):
    name: str
    repo: str
    stack: str


class FeatureRequest(BaseModel):
    prompt: str
    type: str


class JobStatus(BaseModel):
    status: str
    logs: list[str]

# In-memory store for demo purposes
projects: list[Project] = []
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "projects": projects})

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/projects", response_model=Project)
async def create_project(project: Project) -> Project:
    projects.append(project)
    return project

@app.get("/projects", response_model=list[Project])
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
