PERFIL ?= docente-cine-debate

python:
	uv run cvgen --perfil $(PERFIL)

c:
	$(MAKE) -C c
	c/build/cvgen-c -p $(PERFIL)

test:
	uv run pytest -q
	$(MAKE) -C c test

lint:
	uv run ruff check python
	uv run ruff format --check python

.PHONY: python c test lint
