
from fastapi import FastAPI
from pydantic import BaseModel
import re

app = FastAPI(
    title="SalesForge Intelligent Lead Filtering Engine",
    description="API for lead scoring and quality classification",
    version="1.0.0"
)


class LeadInput(BaseModel):
    company: str
    job_title: str
    location: str
    job_url: str
    hr_name: str = ""
    hr_email: str = ""
    hr_phone: str = ""
    hr_profile_url: str = ""


def validate_email(email):
    if not email:
        return "Missing"

    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"

    if re.match(pattern, email):
        return "Valid"

    return "Invalid"


def validate_phone(phone):
    if not phone:
        return "Missing"

    digits = re.sub(r"\D", "", phone)

    if 10 <= len(digits) <= 15:
        return "Valid"

    return "Invalid"


def calculate_lead_score(lead):
    score = 0
    reasons = []

    if lead.company.strip():
        score += 15
        reasons.append("Company available")

    if lead.job_title.strip():
        score += 15
        reasons.append("Job title available")

    if lead.location.strip():
        score += 10
        reasons.append("Location available")

    if lead.job_url.strip():
        score += 15
        reasons.append("Job URL available")

    if lead.hr_name.strip():
        score += 10
        reasons.append("HR name available")

    if lead.hr_profile_url.strip():
        score += 15
        reasons.append("HR profile available")

    if validate_email(lead.hr_email) == "Valid":
        score += 10
        reasons.append("Valid email available")

    if validate_phone(lead.hr_phone) == "Valid":
        score += 10
        reasons.append("Valid phone available")

    return score, reasons


def classify_lead(score):
    if score >= 80:
        return "High Quality"
    elif score >= 50:
        return "Medium Quality"
    else:
        return "Low Quality"


@app.get("/")
def home():
    return {
        "message": "SalesForge Intelligent Lead Filtering Engine is running!",
        "status": "active",
        "version": "1.0.0"
    }


@app.post("/score")
def score_lead_api(lead: LeadInput):
    score, reasons = calculate_lead_score(lead)

    category = classify_lead(score)

    return {
        "company": lead.company,
        "job_title": lead.job_title,
        "lead_score": score,
        "lead_category": category,
        "score_reasons": reasons
    }
