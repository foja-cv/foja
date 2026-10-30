/* Unit and end-to-end tests. Usage: test <data_dir> */
#include <math.h>
#include <stdio.h>
#include <string.h>

#include "cv.h"
#include "layout.h"
#include "pdf.h"

static int failures = 0;

#define CHECK(cond)                                                                       \
    do {                                                                                  \
        if (!(cond)) {                                                                    \
            fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond);      \
            failures++;                                                                   \
        }                                                                                 \
    } while (0)

static void test_json(Arena *arena) {
    char err[128];
    const Json *root = json_parse(
        arena, "{\"a\": [1, -2.5e1, true, false, null], \"s\": \"\\u00e1\\ud83c\\udfac\\n\"}", err,
        sizeof err);
    CHECK(root != NULL);
    const Json *a = json_get(root, "a");
    CHECK(a != NULL && a->type == JSON_ARRAY && a->len == 5);
    CHECK(a->items[1]->number == -25.0);
    CHECK(a->items[2]->boolean && !a->items[3]->boolean);
    CHECK(a->items[4]->type == JSON_NULL);
    CHECK(strcmp(json_string(root, "s"), "\xC3\xA1\xF0\x9F\x8E\xAC\n") == 0);
    CHECK(json_get(root, "missing") == NULL);

    CHECK(json_parse(arena, "[1, 2,]", err, sizeof err) == NULL);
    CHECK(json_parse(arena, "{\"a\": 1} x", err, sizeof err) == NULL);
    CHECK(json_parse(arena, "\n\"open", err, sizeof err) == NULL);
    CHECK(strncmp(err, "line 2:", 7) == 0);
}

static void test_markdown(Arena *arena) {
    Item *items;
    size_t n = md_parse(arena, "intro\n# Uno\nprimera\nsegunda\n\n# Dos\ntercera", &items);
    CHECK(n == 3);
    CHECK(items[0].heading == NULL && strcmp(items[0].text, "intro") == 0);
    CHECK(strcmp(items[1].heading, "Uno") == 0 && strcmp(items[1].text, "primera segunda") == 0);
    CHECK(strcmp(items[2].heading, "Dos") == 0 && strcmp(items[2].text, "tercera") == 0);
}

static void test_winansi(Arena *arena) {
    CHECK(strcmp(utf8_to_winansi(arena, "Ñandú – ok"), "\xD1" "and\xFA \x96 ok") == 0);
    CHECK(strcmp(utf8_to_winansi(arena, "\xF0\x9F\x8E\xAC"), "?") == 0);
}

static void test_period(Arena *arena) {
    const char *cases[][2] = {
        {"{}", ""},
        {"{\"desde\": \"2026-10\"}", "10/2026"},
        {"{\"desde\": \"2018-07\", \"hasta\": null}", "07/2018 \xE2\x80\x93 actualidad"},
        {"{\"desde\": \"2024-09\", \"hasta\": \"2024-10\"}", "09/2024 \xE2\x80\x93 10/2024"},
    };
    char err[128];
    for (size_t i = 0; i < sizeof cases / sizeof *cases; i++) {
        const char *period =
            cv_format_period(arena, json_parse(arena, cases[i][0], err, sizeof err), err, sizeof err);
        CHECK(period != NULL && strcmp(period, cases[i][1]) == 0);
    }
    CHECK(cv_format_period(arena, json_parse(arena, "{\"desde\": \"julio\"}", err, sizeof err), err,
                           sizeof err) == NULL);
}

static void test_metrics(void) {
    CHECK(fabsf(text_width(FONT_REGULAR, "a", 10) - 5.56f) < 1e-4f);
    CHECK(fabsf(text_width(FONT_BOLD, "\xE9", 10) - 5.56f) < 1e-4f); /* é */
}

static void test_profiles(Arena *arena, const char *data) {
    const char *profiles[] = {"docente-cine-debate", "docente-ia", "programador"};
    size_t nprofiles = sizeof profiles / sizeof profiles[0];
    char err[512];
    for (size_t p = 0; p < nprofiles; p++) {
        Cv cv;
        Jpeg photo;
        Pdf pdf = {0};
        bool built = cv_build(arena, data, profiles[p], &cv, err, sizeof err);
        if (!built) fprintf(stderr, "%s: %s\n", profiles[p], err);
        CHECK(built);
        if (!built) continue;
        CHECK(strcmp(cv.name, "Bautista Damián Fiori") == 0);
        CHECK(jpeg_load(arena, cv.photo, &photo, err, sizeof err));
        CHECK(photo.width > 0 && photo.height > 0);
        CHECK(layout_cv(arena, &cv, &photo, &pdf, err, sizeof err));
        /* The teacher CVs fit on one page; the programmer one overflows onto a second. */
        CHECK(p + 1 < nprofiles ? pdf.npages == 1 : pdf.npages > 1);

        const char *out = arena_printf(arena, "build/test-%s.pdf", profiles[p]);
        CHECK(pdf_save(&pdf, out, err, sizeof err));
        size_t len;
        const char *bytes = read_file(arena, out, &len);
        CHECK(bytes != NULL && len > 1000 && strncmp(bytes, "%PDF-1.4", 8) == 0);
        CHECK(bytes != NULL && memcmp(bytes + len - 6, "%%EOF\n", 6) == 0);
        pdf_free(&pdf);

        if (p == 0) {
            CHECK(strcmp(cv.subtitle, "Docente de cine debate") == 0);
            CHECK(strcmp(cv.side[0].title, "Curso") == 0);
            CHECK(strcmp(cv.sections[0].entries[0].title, "Docente particular") == 0);
            CHECK(cv.sections[0].entries[0].ntasks == 4);
        }
    }
    Cv cv;
    CHECK(!cv_build(arena, data, "does-not-exist", &cv, err, sizeof err));
    CHECK(strstr(err, "does-not-exist") != NULL);
}

int main(int argc, char **argv) {
    if (argc != 2) {
        fputs("usage: test <data_dir>\n", stderr);
        return 2;
    }
    Arena arena = {0};
    test_json(&arena);
    test_markdown(&arena);
    test_winansi(&arena);
    test_period(&arena);
    test_metrics();
    test_profiles(&arena, argv[1]);
    arena_free(&arena);
    if (failures == 0) puts("all C tests passed");
    return failures == 0 ? 0 : 1;
}
