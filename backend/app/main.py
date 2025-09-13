
from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI()
templates = Jinja2Templates(directory="backend/app/templates")



class Project(BaseModel):
    name: str
    repo: str
    stack: str


class LoginRequest(BaseModel):
    username: str
    password: str

# In-memory store for demo purposes
projects: list[Project] = []

FAKE_TOKEN = "secret-token"


def verify_token(authorization: str | None = Header(default=None)) -> None:
    """Simple token verification dependency."""
    expected = f"Bearer {FAKE_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "projects": projects})
@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/token")
async def login(data: LoginRequest) -> dict[str, str]:
    if data.username == "admin" and data.password == "secret":
        return {"access_token": FAKE_TOKEN}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

@app.post("/projects", response_model=Project, dependencies=[Depends(verify_token)])
async def create_project(project: Project) -> Project:
    projects.append(project)
    return project

@app.get("/projects", response_model=list[Project], dependencies=[Depends(verify_token)])
async def list_projects() -> list[Project]:
    return projects
