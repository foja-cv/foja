/* Shared helpers: a bump arena for everything that lives until exit, and a growable byte buffer. */
#ifndef CV_COMMON_H
#define CV_COMMON_H

#include <stdbool.h>
#include <stddef.h>

typedef struct ArenaBlock ArenaBlock;
typedef struct {
    ArenaBlock *head;
} Arena;

void *arena_alloc(Arena *arena, size_t size); /* zeroed; exits on out of memory */
void *arena_copy(Arena *arena, const void *data, size_t size);
char *arena_strndup(Arena *arena, const char *text, size_t len);
char *arena_strdup(Arena *arena, const char *text);
char *arena_printf(Arena *arena, const char *fmt, ...) __attribute__((format(printf, 2, 3)));
void arena_free(Arena *arena);

typedef struct {
    char *data;
    size_t len, cap;
} Buf;

void buf_append(Buf *buf, const void *data, size_t len);
void buf_printf(Buf *buf, const char *fmt, ...) __attribute__((format(printf, 2, 3)));
void buf_free(Buf *buf);

/* Whole file, NUL-terminated; NULL if it cannot be read. `len` may be NULL. */
char *read_file(Arena *arena, const char *path, size_t *len);

#endif
