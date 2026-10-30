# SalesForge Intelligent Lead Filtering Engine API

## Overview
An API-based lead scoring system that evaluates lead information and classifies leads based on data completeness.

## Features
- Lead information validation
- Rule-based lead scoring (0–100)
- High, Medium, and Low quality classification
- Score explanations
- FastAPI endpoints

## Requirements
Install the required packages:

pip install -r requirements.txt

## Run the API

uvicorn SalesForge_API:app --host 127.0.0.1 --port 8000

## API Endpoints

GET /
Checks whether the API is running.

POST /score
Accepts lead information and returns its score, category, and scoring reasons.

## Technologies
- Python
- FastAPI
- Pydantic
- Uvicorn
