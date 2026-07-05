.PHONY: dev dev-backend dev-frontend migrate test lint keys clean

dev:
	docker compose up

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

migrate:
	cd backend && alembic upgrade head

migrate-fresh:
	cd backend && alembic downgrade base && alembic upgrade head

keys:
	mkdir -p backend/keys
	openssl genrsa -out backend/keys/private.pem 2048
	openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem

dev-worker:
	cd backend && celery -A app.celery_app worker --loglevel=info --concurrency=2

test:
	cd backend && python -m pytest

test-frontend:
	cd frontend && npm test

lint:
	cd backend && ruff check . --fix
	cd backend && mypy app

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

clean:
	docker compose down -v
