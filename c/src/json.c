#include "json.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define JSON_MAX_DEPTH 64

typedef struct {
    Arena *arena;
    const char *start;
    const char *p;
    char *err;
    size_t errlen;
    int depth;
} Parser;

static Json *parse_value(Parser *ps);

static void *fail(Parser *ps, const char *message) {
    if (ps->err[0] == '\0') {
        int line = 1;
        for (const char *c = ps->start; c < ps->p; c++) line += *c == '\n';
        snprintf(ps->err, ps->errlen, "line %d: %s", line, message);
    }
    return NULL;
}

static void skip_space(Parser *ps) {
    while (*ps->p == ' ' || *ps->p == '\t' || *ps->p == '\n' || *ps->p == '\r') ps->p++;
}

static void put_utf8(Buf *out, unsigned long cp) {
    unsigned char bytes[4];
    size_t n;
    if (cp < 0x80) {
        bytes[0] = (unsigned char)cp;
        n = 1;
    } else if (cp < 0x800) {
        bytes[0] = (unsigned char)(0xC0 | (cp >> 6));
        bytes[1] = (unsigned char)(0x80 | (cp & 0x3F));
        n = 2;
    } else if (cp < 0x10000) {
        bytes[0] = (unsigned char)(0xE0 | (cp >> 12));
        bytes[1] = (unsigned char)(0x80 | ((cp >> 6) & 0x3F));
        bytes[2] = (unsigned char)(0x80 | (cp & 0x3F));
        n = 3;
    } else {
        bytes[0] = (unsigned char)(0xF0 | (cp >> 18));
        bytes[1] = (unsigned char)(0x80 | ((cp >> 12) & 0x3F));
        bytes[2] = (unsigned char)(0x80 | ((cp >> 6) & 0x3F));
        bytes[3] = (unsigned char)(0x80 | (cp & 0x3F));
        n = 4;
    }
    buf_append(out, bytes, n);
}

static bool hex4(const char *s, unsigned long *out) {
    *out = 0;
    for (int i = 0; i < 4; i++) {
        char c = s[i];
        int digit;
        if (c >= '0' && c <= '9') digit = c - '0';
        else if (c >= 'a' && c <= 'f') digit = c - 'a' + 10;
        else if (c >= 'A' && c <= 'F') digit = c - 'A' + 10;
        else return false;
        *out = *out << 4 | (unsigned long)digit;
    }
    return true;
}

/* Reads one escape after the backslash; false on a malformed one. */
static bool parse_escape(Parser *ps, Buf *out) {
    char c = *ps->p++;
    switch (c) {
    case '"': case '\\': case '/': buf_append(out, &c, 1); return true;
    case 'b': buf_append(out, "\b", 1); return true;
    case 'f': buf_append(out, "\f", 1); return true;
    case 'n': buf_append(out, "\n", 1); return true;
    case 'r': buf_append(out, "\r", 1); return true;
    case 't': buf_append(out, "\t", 1); return true;
    case 'u': break;
    default: return false;
    }
    unsigned long cp, low;
    if (!hex4(ps->p, &cp)) return false;
    ps->p += 4;
    if (cp >= 0xDC00 && cp <= 0xDFFF) return false;
    if (cp >= 0xD800 && cp <= 0xDBFF) {
        if (ps->p[0] != '\\' || ps->p[1] != 'u' || !hex4(ps->p + 2, &low) || low < 0xDC00 ||
            low > 0xDFFF)
            return false;
        ps->p += 6;
        cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
    }
    put_utf8(out, cp);
    return true;
}

static const char *parse_string(Parser *ps) {
    ps->p++; /* opening quote */
    Buf out = {0};
    const char *result = NULL;
    for (;;) {
        unsigned char c = (unsigned char)*ps->p;
        if (c == '"') {
            ps->p++;
            result = arena_strndup(ps->arena, out.data, out.len);
            break;
        }
        if (c == '\0') {
            fail(ps, "unterminated string");
            break;
        }
        if (c < 0x20) {
            fail(ps, "control character in string");
            break;
        }
        if (c == '\\') {
            ps->p++;
            if (!parse_escape(ps, &out)) {
                fail(ps, "bad escape in string");
                break;
            }
        } else {
            buf_append(&out, ps->p++, 1);
        }
    }
    buf_free(&out);
    return result;
}

static Json *parse_list(Parser *ps, bool is_object) {
    char close = is_object ? '}' : ']';
    Buf values = {0}, keys = {0};
    Json *result = NULL;
    ps->p++;
    if (++ps->depth > JSON_MAX_DEPTH) {
        fail(ps, "nesting too deep");
        goto done;
    }
    skip_space(ps);
    if (*ps->p == close) {
        ps->p++;
    } else {
        for (;;) {
            if (is_object) {
                skip_space(ps);
                if (*ps->p != '"') {
                    fail(ps, "expected a key");
                    goto done;
                }
                const char *key = parse_string(ps);
                if (key == NULL) goto done;
                skip_space(ps);
                if (*ps->p != ':') {
                    fail(ps, "expected ':'");
                    goto done;
                }
                ps->p++;
                buf_append(&keys, &key, sizeof key);
            }
            Json *value = parse_value(ps);
            if (value == NULL) goto done;
            buf_append(&values, &value, sizeof value);
            skip_space(ps);
            if (*ps->p == ',') {
                ps->p++;
                continue;
            }
            if (*ps->p == close) {
                ps->p++;
                break;
            }
            fail(ps, is_object ? "expected ',' or '}'" : "expected ',' or ']'");
            goto done;
        }
    }
    result = arena_alloc(ps->arena, sizeof *result);
    result->type = is_object ? JSON_OBJECT : JSON_ARRAY;
    result->len = values.len / sizeof(Json *);
    result->items = arena_copy(ps->arena, values.data, values.len);
    if (is_object) result->keys = arena_copy(ps->arena, keys.data, keys.len);
done:
    ps->depth--;
    buf_free(&values);
    buf_free(&keys);
    return result;
}

static bool literal(Parser *ps, const char *word) {
    size_t len = strlen(word);
    if (strncmp(ps->p, word, len) != 0) return false;
    ps->p += len;
    return true;
}

static Json *parse_value(Parser *ps) {
    skip_space(ps);
    char c = *ps->p;
    if (c == '{') return parse_list(ps, true);
    if (c == '[') return parse_list(ps, false);

    Json *value = arena_alloc(ps->arena, sizeof *value);
    if (c == '"') {
        value->type = JSON_STRING;
        value->string = parse_string(ps);
        return value->string ? value : NULL;
    }
    if (literal(ps, "true") || literal(ps, "false")) {
        value->type = JSON_BOOL;
        value->boolean = c == 't';
        return value;
    }
    if (literal(ps, "null")) return value; /* zeroed: JSON_NULL */
    if (c == '-' || (c >= '0' && c <= '9')) {
        char *end;
        value->type = JSON_NUMBER;
        value->number = strtod(ps->p, &end);
        ps->p = end;
        return value;
    }
    return fail(ps, c == '\0' ? "unexpected end of input" : "unexpected character");
}

Json *json_parse(Arena *arena, const char *text, char *err, size_t errlen) {
    Parser ps = {arena, text, text, err, errlen, 0};
    err[0] = '\0';
    Json *root = parse_value(&ps);
    if (root == NULL) return NULL;
    skip_space(&ps);
    if (*ps.p != '\0') return fail(&ps, "trailing characters after the value");
    return root;
}

const Json *json_get(const Json *object, const char *key) {
    if (object == NULL || object->type != JSON_OBJECT) return NULL;
    for (size_t i = 0; i < object->len; i++)
        if (strcmp(object->keys[i], key) == 0) return object->items[i];
    return NULL;
}

const char *json_string(const Json *object, const char *key) {
    const Json *value = json_get(object, key);
    return value != NULL && value->type == JSON_STRING ? value->string : NULL;
}
