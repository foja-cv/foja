#include "text.h"

#include <ctype.h>
#include <string.h>

static void flush_item(Arena *arena, Buf *items, const char *heading, Buf *paragraph) {
    Item item = {heading, arena_strndup(arena, paragraph->data, paragraph->len)};
    buf_append(items, &item, sizeof item);
    paragraph->len = 0;
}

size_t md_parse(Arena *arena, const char *text, Item **items) {
    Buf found = {0}, paragraph = {0};
    const char *heading = NULL;
    bool open = false;
    const char *line = text;
    while (*line != '\0') {
        const char *end = strchr(line, '\n');
        if (end == NULL) end = line + strlen(line);
        const char *a = line, *b = end;
        while (a < b && isspace((unsigned char)*a)) a++;
        while (b > a && isspace((unsigned char)b[-1])) b--;
        if (a < b && *a == '#') {
            if (open) flush_item(arena, &found, heading, &paragraph);
            while (a < b && (*a == '#' || isspace((unsigned char)*a))) a++;
            heading = arena_strndup(arena, a, (size_t)(b - a));
            open = true;
        } else if (a < b) {
            if (!open) heading = NULL;
            open = true;
            if (paragraph.len > 0) buf_append(&paragraph, " ", 1);
            buf_append(&paragraph, a, (size_t)(b - a));
        }
        line = *end != '\0' ? end + 1 : end;
    }
    if (open) flush_item(arena, &found, heading, &paragraph);
    *items = arena_copy(arena, found.data, found.len);
    size_t count = found.len / sizeof(Item);
    buf_free(&found);
    buf_free(&paragraph);
    return count;
}

char *trim(Arena *arena, const char *text) {
    const char *a = text, *b = text + strlen(text);
    while (a < b && isspace((unsigned char)*a)) a++;
    while (b > a && isspace((unsigned char)b[-1])) b--;
    return arena_strndup(arena, a, (size_t)(b - a));
}

static unsigned char winansi(unsigned long cp) {
    if (cp < 0x80 || (cp >= 0xA0 && cp <= 0xFF)) return (unsigned char)cp;
    switch (cp) {
    case 0x20AC: return 0x80; /* € */
    case 0x2026: return 0x85; /* … */
    case 0x2018: return 0x91;
    case 0x2019: return 0x92;
    case 0x201C: return 0x93;
    case 0x201D: return 0x94;
    case 0x2022: return 0x95; /* • */
    case 0x2013: return 0x96; /* – */
    case 0x2014: return 0x97; /* — */
    default: return '?';
    }
}

char *utf8_to_winansi(Arena *arena, const char *utf8) {
    unsigned char *out = arena_alloc(arena, strlen(utf8) + 1), *o = out;
    const unsigned char *p = (const unsigned char *)utf8;
    while (*p != '\0') {
        unsigned long cp;
        int extra;
        if (*p < 0x80) cp = *p, extra = 0;
        else if ((*p & 0xE0) == 0xC0) cp = *p & 0x1F, extra = 1;
        else if ((*p & 0xF0) == 0xE0) cp = *p & 0x0F, extra = 2;
        else if ((*p & 0xF8) == 0xF0) cp = *p & 0x07, extra = 3;
        else {
            *o++ = '?';
            p++;
            continue;
        }
        p++;
        for (; extra > 0 && (*p & 0xC0) == 0x80; extra--, p++) cp = cp << 6 | (*p & 0x3F);
        *o++ = extra == 0 ? winansi(cp) : '?';
    }
    *o = '\0';
    return (char *)out;
}
