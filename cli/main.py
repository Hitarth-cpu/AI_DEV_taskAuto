import typer
import requests
import json

app = typer.Typer(help="AI Developer Agent CLI")

API_BASE = "http://localhost:8000/api/v1"

@app.command()
def automate(task: str, env: str = typer.Option("linux", help="Target OS (linux, windows)")):
    """Generate automation script for a specific task."""
    typer.echo(f"Requesting automation for: {task}...")
    try:
        res = requests.post(f"{API_BASE}/automate", json={"task_description": task, "target_env": env})
        res.raise_for_status()
        data = res.json()
        typer.secho("\n--- Generated Script ---", fg=typer.colors.GREEN)
        typer.echo(data["script"])
        typer.secho("\n--- Reasoning ---", fg=typer.colors.CYAN)
        typer.echo(data["reasoning"])
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED)

@app.command()
def assess(file_path: str, lang: str = typer.Option("python", help="Primary language of the snippet")):
    """Assess a code snippet from a file."""
    try:
        with open(file_path, "r") as f:
            code = f.read()
            
        res = requests.post(f"{API_BASE}/assess", json={"code_snippet": code, "language": lang})
        res.raise_for_status()
        data = res.json()
        
        typer.secho(f"\nAssessment Result ({data['primary_language']})", fg=typer.colors.MAGENTA, bold=True)
        typer.echo(f"Level: {data['overall_level']} (Score: {data['technical_score']}/10)")
        typer.echo("Strengths: " + ", ".join(data['key_strengths']))
        typer.echo("\nAreas for Improvement:")
        for item in data['areas_for_improvement']:
            typer.echo(f"- [{item['severity']}] {item['issue']}: {item['suggestion']}")
            
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED)

if __name__ == "__main__":
    app()
