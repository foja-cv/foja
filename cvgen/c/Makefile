CC ?= cc
CFLAGS ?= -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -O2 -g
BUILD := build
SRC := common json text metrics cv pdf layout
OBJ := $(SRC:%=$(BUILD)/%.o)
HEADERS := $(wildcard src/*.h)

all: $(BUILD)/cvgen-c

$(BUILD)/cvgen-c: $(OBJ) $(BUILD)/main.o
	$(CC) $(CFLAGS) -o $@ $^

$(BUILD)/test: tests/test.c $(OBJ) $(HEADERS)
	$(CC) $(CFLAGS) -Isrc -o $@ tests/test.c $(OBJ) -lm

$(BUILD)/%.o: src/%.c $(HEADERS) | $(BUILD)
	$(CC) $(CFLAGS) -c -o $@ $<

$(BUILD):
	mkdir -p $@

test: $(BUILD)/test
	./$(BUILD)/test ../data

clean:
	rm -rf $(BUILD)

.PHONY: all test clean
