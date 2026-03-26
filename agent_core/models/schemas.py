from pydantic import BaseModel, Field
from typing import List, Optional

class TaskRequest(BaseModel):
    task_description: str
    target_env: str = Field(default="linux", description="Target environment (linux, windows, macos)")
    working_directory: str = Field(default="", description="The directory where the script will run. Empty = daemon default.")

class TaskResponse(BaseModel):
    id: Optional[int] = None
    script: str
    reasoning: str
    validation_script: Optional[str] = None
    blast_radius_report: Optional[List[str]] = None
    
class CodeFeedback(BaseModel):
    issue: str
    severity: str = Field(pattern="^(Low|Medium|High)$")
    suggestion: str

class SkillAssessmentRequest(BaseModel):
    code_snippet: str
    language: str = "python"
    working_directory: Optional[str] = None

class SkillAssessment(BaseModel):
    primary_language: str
    overall_level: str = Field(pattern="^(Beginner|Intermediate|Advanced|Unknown)$")
    technical_score: float = Field(ge=0, le=10)
    key_strengths: List[str]
    areas_for_improvement: List[CodeFeedback]
    test_execution_output: Optional[str] = None
    tester_suggestions: List[str] = Field(default_factory=list, description="Suggestions acting as a QA tester based on code execution output.")
