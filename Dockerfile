FROM python:3.12-slim-bookworm AS base

# Install Poetry
RUN pip install poetry
ENV POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1
ENV PATH="$PATH:$POETRY_HOME/bin"

# Install system dependencies for PostgreSQL development
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app

# Copy and install dependencies
COPY pyproject.toml ./
RUN poetry lock && poetry install --only=main

# Copy project files
COPY . .

# Runtime stage
FROM base AS runtime
WORKDIR /app

# Copy built application
COPY --from=build /app /app

# Set up environment
ENV PATH="/app/.venv/bin:$PATH"
RUN echo "source /app/.venv/bin/activate" >> /etc/profile.d/venv.sh

# Expose application port
EXPOSE 5000

# Set default command
CMD ["flask", "--app", "app", "run", "--host", "0.0.0.0"]
