/* Minimal JSON parser (RFC 8259) that builds a read-only tree in an arena. */
#ifndef CV_JSON_H
#define CV_JSON_H

#include "common.h"

typedef enum { JSON_NULL, JSON_BOOL, JSON_NUMBER, JSON_STRING, JSON_ARRAY, JSON_OBJECT } JsonType;

typedef struct Json Json;
struct Json {
    JsonType type;
    bool boolean;
    double number;
    const char *string; /* UTF-8 */
    size_t len;         /* number of items of an array or object */
    Json **items;
    const char **keys; /* object keys, parallel to items */
};

/* NULL on error, with a message ("line N: ...") in err. */
Json *json_parse(Arena *arena, const char *text, char *err, size_t errlen);

/* Member of an object, or NULL if absent (a JSON null is returned as a JSON_NULL value). */
const Json *json_get(const Json *object, const char *key);
/* String member, or NULL if absent or not a string. */
const char *json_string(const Json *object, const char *key);

#endif
