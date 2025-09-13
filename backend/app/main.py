from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")

class Project(BaseModel):
    name: str
    repo: str
    stack: str

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
