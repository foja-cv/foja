#include "common.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARENA_BLOCK_SIZE 65536

struct ArenaBlock {
    ArenaBlock *next;
    size_t used, cap;
    max_align_t data[];
};

static void out_of_memory(void) {
    fputs("out of memory\n", stderr);
    exit(1);
}

void *arena_alloc(Arena *arena, size_t size) {
    size_t align = _Alignof(max_align_t);
    size = (size + align - 1) / align * align;
    ArenaBlock *block = arena->head;
    if (block == NULL || block->cap - block->used < size) {
        size_t cap = size > ARENA_BLOCK_SIZE ? size : ARENA_BLOCK_SIZE;
        block = malloc(sizeof *block + cap);
        if (block == NULL) out_of_memory();
        block->next = arena->head;
        block->used = 0;
        block->cap = cap;
        arena->head = block;
    }
    char *ptr = (char *)block->data + block->used;
    block->used += size;
    memset(ptr, 0, size);
    return ptr;
}

void *arena_copy(Arena *arena, const void *data, size_t size) {
    void *ptr = arena_alloc(arena, size);
    if (size > 0) memcpy(ptr, data, size);
    return ptr;
}

char *arena_strndup(Arena *arena, const char *text, size_t len) {
    char *copy = arena_alloc(arena, len + 1);
    if (len > 0) memcpy(copy, text, len);
    return copy;
}

char *arena_strdup(Arena *arena, const char *text) {
    return arena_strndup(arena, text, strlen(text));
}

char *arena_printf(Arena *arena, const char *fmt, ...) {
    va_list args, copy;
    va_start(args, fmt);
    va_copy(copy, args);
    int len = vsnprintf(NULL, 0, fmt, copy);
    va_end(copy);
    char *out = arena_alloc(arena, (size_t)len + 1);
    vsnprintf(out, (size_t)len + 1, fmt, args);
    va_end(args);
    return out;
}

void arena_free(Arena *arena) {
    while (arena->head != NULL) {
        ArenaBlock *next = arena->head->next;
        free(arena->head);
        arena->head = next;
    }
}

static void buf_reserve(Buf *buf, size_t extra) {
    if (buf->len + extra <= buf->cap) return;
    size_t cap = buf->cap ? buf->cap : 256;
    while (cap < buf->len + extra) cap *= 2;
    char *data = realloc(buf->data, cap);
    if (data == NULL) out_of_memory();
    buf->data = data;
    buf->cap = cap;
}

void buf_append(Buf *buf, const void *data, size_t len) {
    if (len == 0) return;
    buf_reserve(buf, len);
    memcpy(buf->data + buf->len, data, len);
    buf->len += len;
}

void buf_printf(Buf *buf, const char *fmt, ...) {
    va_list args, copy;
    va_start(args, fmt);
    va_copy(copy, args);
    int len = vsnprintf(NULL, 0, fmt, copy);
    va_end(copy);
    buf_reserve(buf, (size_t)len + 1);
    vsnprintf(buf->data + buf->len, (size_t)len + 1, fmt, args);
    buf->len += (size_t)len;
    va_end(args);
}

void buf_free(Buf *buf) {
    free(buf->data);
    *buf = (Buf){0};
}

char *read_file(Arena *arena, const char *path, size_t *len) {
    FILE *file = fopen(path, "rb");
    if (file == NULL) return NULL;
    Buf buf = {0};
    char chunk[8192];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, file)) > 0) buf_append(&buf, chunk, n);
    bool failed = ferror(file);
    fclose(file);
    if (failed) {
        buf_free(&buf);
        return NULL;
    }
    char *out = arena_strndup(arena, buf.data, buf.len);
    if (len != NULL) *len = buf.len;
    buf_free(&buf);
    return out;
}
