#include "cv.h"

#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    Arena *arena;
    const char *dir;
    const char *private_path; /* the address, kept out of git */
    char *err;
    size_t errlen;
} Ctx;

static const char *const CONTACTS[] = {"telefono", "correo", "github", "linkedin", "web"};

__attribute__((format(printf, 2, 3))) static bool fail(Ctx *ctx, const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    vsnprintf(ctx->err, ctx->errlen, fmt, args);
    va_end(args);
    return false;
}

static const char *data_path(Ctx *ctx, const char *relative) {
    return arena_printf(ctx->arena, "%s/%s", ctx->dir, relative);
}

static const Json *load_json_at(Ctx *ctx, const char *path) {
    const char *text = read_file(ctx->arena, path, NULL);
    if (text == NULL) {
        fail(ctx, "missing file: %s", path);
        return NULL;
    }
    char why[160];
    const Json *json = json_parse(ctx->arena, text, why, sizeof why);
    if (json == NULL) fail(ctx, "invalid JSON in %s: %s", path, why);
    return json;
}

static const Json *load_json(Ctx *ctx, const char *relative) {
    return load_json_at(ctx, data_path(ctx, relative));
}

static const char *load_text(Ctx *ctx, const char *relative) {
    const char *path = data_path(ctx, relative);
    const char *text = read_file(ctx->arena, path, NULL);
    if (text == NULL) {
        fail(ctx, "missing file: %s", path);
        return NULL;
    }
    return trim(ctx->arena, text);
}

static const char *required(Ctx *ctx, const Json *object, const char *key, const char *where) {
    const char *value = json_string(object, key);
    if (value == NULL) fail(ctx, "%s: \"%s\" must be a string", where, key);
    return value;
}

static const char *optional(const Json *object, const char *key) {
    const char *value = json_string(object, key);
    return value != NULL ? value : "";
}

static bool string_list(Ctx *ctx, const Json *array, const char *where, const char ***out,
                        size_t *count) {
    if (array == NULL || array->type != JSON_ARRAY)
        return fail(ctx, "%s must be a list of strings", where);
    *out = arena_alloc(ctx->arena, array->len * sizeof **out);
    for (size_t i = 0; i < array->len; i++) {
        if (array->items[i]->type != JSON_STRING)
            return fail(ctx, "%s must be a list of strings", where);
        (*out)[i] = array->items[i]->string;
    }
    *count = array->len;
    return true;
}

/* Items are a list of strings or the path of a Markdown file; absent means none. */
static bool load_items(Ctx *ctx, const Json *value, const char *where, Item **items,
                       size_t *count) {
    *items = NULL;
    *count = 0;
    if (value == NULL) return true;
    if (value->type == JSON_STRING) {
        const char *text = load_text(ctx, value->string);
        if (text == NULL) return false;
        *count = md_parse(ctx->arena, text, items);
        return true;
    }
    const char **lines;
    if (!string_list(ctx, value, where, &lines, count)) return false;
    *items = arena_alloc(ctx->arena, *count * sizeof **items);
    for (size_t i = 0; i < *count; i++) (*items)[i].text = lines[i];
    return true;
}

static bool format_month(const char *value, char out[8]) {
    if (strlen(value) != 7 || value[4] != '-') return false;
    for (int i = 0; i < 7; i++)
        if (i != 4 && !isdigit((unsigned char)value[i])) return false;
    memcpy(out, value + 5, 2);
    out[2] = '/';
    memcpy(out + 3, value, 4);
    out[7] = '\0';
    return true;
}

const char *cv_format_period(Arena *arena, const Json *raw, char *err, size_t errlen) {
    const Json *from = json_get(raw, "desde"), *to = json_get(raw, "hasta");
    char start[8], end[8];
    if (from == NULL) return "";
    if (from->type != JSON_STRING || !format_month(from->string, start)) {
        snprintf(err, errlen, "bad \"desde\" date, expected YYYY-MM");
        return NULL;
    }
    if (to == NULL) return arena_strdup(arena, start);
    if (to->type == JSON_NULL) return arena_printf(arena, "%s \xE2\x80\x93 actualidad", start);
    if (to->type != JSON_STRING || !format_month(to->string, end)) {
        snprintf(err, errlen, "bad \"hasta\" date, expected YYYY-MM or null");
        return NULL;
    }
    return arena_printf(arena, "%s \xE2\x80\x93 %s", start, end);
}

static bool build_entry(Ctx *ctx, const char *key, const Json *raw, Entry *entry) {
    const char *where = arena_printf(ctx->arena, "entry \"%s\"", key);
    if ((entry->title = required(ctx, raw, "titulo", where)) == NULL) return false;
    entry->place = optional(raw, "lugar");
    entry->note = optional(raw, "nota");
    char why[96];
    if ((entry->period = cv_format_period(ctx->arena, raw, why, sizeof why)) == NULL)
        return fail(ctx, "%s: %s", where, why);
    return load_items(ctx, json_get(raw, "tareas"), where, &entry->tasks, &entry->ntasks);
}

static bool build_section(Ctx *ctx, const Json *raw, const Json *entries, Section *section) {
    if ((section->title = required(ctx, raw, "titulo", "section")) == NULL) return false;
    const char *where = arena_printf(ctx->arena, "section \"%s\"", section->title);
    const Json *compact = json_get(raw, "compacto");
    section->compact = compact != NULL && compact->type == JSON_BOOL && compact->boolean;
    const Json *side = json_get(raw, "lateral");
    section->side = side != NULL && side->type == JSON_BOOL && side->boolean;

    const Json *ids = json_get(raw, "entradas");
    if (ids != NULL) {
        const char **keys;
        if (!string_list(ctx, ids, where, &keys, &section->nentries)) return false;
        section->entries = arena_alloc(ctx->arena, section->nentries * sizeof *section->entries);
        for (size_t i = 0; i < section->nentries; i++) {
            const Json *raw_entry = json_get(entries, keys[i]);
            if (raw_entry == NULL) return fail(ctx, "%s uses unknown entry \"%s\"", where, keys[i]);
            if (!build_entry(ctx, keys[i], raw_entry, &section->entries[i])) return false;
        }
    }
    return load_items(ctx, json_get(raw, "items"), where, &section->items, &section->nitems);
}

static SideBlock *add_block(Cv *cv, const char *title, size_t nlines, Arena *arena) {
    SideBlock *block = &cv->side[cv->nside++];
    block->title = title;
    block->nlines = nlines;
    block->lines = arena_alloc(arena, nlines * sizeof *block->lines);
    return block;
}

static bool build_side(Ctx *ctx, const Json *base, const Json *profile, Cv *cv) {
    const Json *groups = json_get(profile, "habilidades");
    size_t ngroups = groups != NULL && groups->type == JSON_ARRAY ? groups->len : 0;
    cv->side = arena_alloc(ctx->arena, (3 + ngroups) * sizeof *cv->side);

    const char *application = json_string(profile, "postulacion");
    if (application != NULL) add_block(cv, "Curso", 1, ctx->arena)->lines[0] = application;

    /* Only profiles that ask for it show the address. */
    const Json *show_address = json_get(profile, "domicilio");
    if (show_address != NULL && show_address->type == JSON_BOOL && show_address->boolean) {
        if (read_file(ctx->arena, ctx->private_path, NULL) == NULL)
            return fail(ctx, "profile shows the address but %s is missing", ctx->private_path);
        const Json *private = load_json_at(ctx, ctx->private_path);
        if (private == NULL) return false;
        const Json *address = json_get(private, "domicilio");
        const char *street = required(ctx, address, "calle", "domicilio");
        const char *city = required(ctx, address, "ciudad", "domicilio");
        const char *province = required(ctx, address, "provincia", "domicilio");
        const char *country = required(ctx, address, "pais", "domicilio");
        if (!street || !city || !province || !country) return false;
        SideBlock *address_block = add_block(cv, "Domicilio", 3, ctx->arena);
        address_block->lines[0] = street;
        address_block->lines[1] = city;
        address_block->lines[2] = arena_printf(ctx->arena, "%s, %s", province, country);
    }

    const char **keys;
    size_t nkeys;
    if (!string_list(ctx, json_get(profile, "contactos"), "contactos", &keys, &nkeys)) return false;
    SideBlock *block = add_block(cv, "Contacto", nkeys, ctx->arena);
    for (size_t i = 0; i < nkeys; i++) {
        bool known = false;
        for (size_t k = 0; k < sizeof CONTACTS / sizeof *CONTACTS; k++)
            known = known || strcmp(keys[i], CONTACTS[k]) == 0;
        const char *value = json_string(json_get(base, "contactos"), keys[i]);
        if (!known || value == NULL) return fail(ctx, "unknown contact \"%s\"", keys[i]);
        block->lines[i] = value;
    }

    const Json *skills = json_get(base, "habilidades");
    for (size_t i = 0; i < ngroups; i++) {
        const char *group = groups->items[i]->string;
        if (group == NULL) return fail(ctx, "habilidades must be a list of strings");
        const char **values;
        size_t nvalues;
        const Json *list = json_get(skills, group);
        if (list == NULL) return fail(ctx, "profile uses unknown skill group \"%s\"", group);
        if (!string_list(ctx, list, group, &values, &nvalues)) return false;
        cv->side[cv->nside++] = (SideBlock){group, values, nvalues};
    }
    return true;
}

static bool build_name(Ctx *ctx, const Json *base, Cv *cv) {
    Buf name = {0};
    const char *parts[] = {"nombres", "apellidos"};
    for (size_t p = 0; p < 2; p++) {
        const char **words;
        size_t nwords;
        if (!string_list(ctx, json_get(base, parts[p]), parts[p], &words, &nwords)) {
            buf_free(&name);
            return false;
        }
        for (size_t i = 0; i < nwords; i++) {
            if (name.len > 0) buf_append(&name, " ", 1);
            buf_append(&name, words[i], strlen(words[i]));
        }
    }
    cv->name = arena_strndup(ctx->arena, name.data, name.len);
    buf_free(&name);
    return true;
}

bool cv_build(Arena *arena, const char *data_dir, const char *private_path,
              const char *profile_name, Cv *cv, char *err, size_t errlen) {
    Ctx ctx = {arena, data_dir, private_path, err, errlen};
    if (ctx.private_path == NULL) ctx.private_path = data_path(&ctx, "privado.json");
    *cv = (Cv){0};
    const Json *base = load_json(&ctx, "cv.json");
    if (base == NULL) return false;
    const Json *profile = load_json(&ctx, arena_printf(arena, "perfiles/%s.json", profile_name));
    if (profile == NULL) return false;

    if (!build_name(&ctx, base, cv)) return false;
    if ((cv->subtitle = required(&ctx, profile, "subtitulo", "profile")) == NULL) return false;
    const char *profile_text = required(&ctx, profile, "perfil", "profile");
    if (profile_text == NULL || (cv->profile = load_text(&ctx, profile_text)) == NULL) return false;
    const char *photo = required(&ctx, base, "foto", "cv.json");
    if (photo == NULL) return false;
    cv->photo = data_path(&ctx, photo);
    if (!build_side(&ctx, base, profile, cv)) return false;

    const Json *sections = json_get(profile, "secciones");
    if (sections == NULL || sections->type != JSON_ARRAY)
        return fail(&ctx, "profile: \"secciones\" must be a list");
    cv->nsections = sections->len;
    cv->sections = arena_alloc(arena, cv->nsections * sizeof *cv->sections);
    const Json *entries = json_get(base, "entradas");
    for (size_t i = 0; i < cv->nsections; i++)
        if (!build_section(&ctx, sections->items[i], entries, &cv->sections[i])) return false;
    return true;
}
