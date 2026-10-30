/* cvgen-c: builds the CV PDF from data/ without any library beyond libc. */
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

#include "cv.h"
#include "layout.h"
#include "pdf.h"

static void usage(FILE *out) {
    fputs("usage: cvgen-c [-d data_dir] [-p profile] [-o output.pdf]\n"
          "defaults: -d data -p docente-cine-debate -o build/cv-<profile>-c.pdf\n",
          out);
}

int main(int argc, char **argv) {
    const char *data = "data", *profile = "docente-cine-debate", *output = NULL;
    for (int i = 1; i < argc; i++) {
        bool has_value = i + 1 < argc;
        if (strcmp(argv[i], "-d") == 0 && has_value) data = argv[++i];
        else if (strcmp(argv[i], "-p") == 0 && has_value) profile = argv[++i];
        else if (strcmp(argv[i], "-o") == 0 && has_value) output = argv[++i];
        else if (strcmp(argv[i], "-h") == 0) {
            usage(stdout);
            return 0;
        } else {
            usage(stderr);
            return 2;
        }
    }

    Arena arena = {0};
    Pdf pdf = {0};
    Cv cv;
    Jpeg photo;
    char err[512] = "";
    if (output == NULL) {
        if (mkdir("build", 0755) != 0 && errno != EEXIST) perror("build");
        output = arena_printf(&arena, "build/cv-%s-c.pdf", profile);
    }

    bool ok = cv_build(&arena, data, profile, &cv, err, sizeof err) &&
              jpeg_load(&arena, cv.photo, &photo, err, sizeof err) &&
              layout_cv(&arena, &cv, &photo, &pdf, err, sizeof err) &&
              pdf_save(&pdf, output, err, sizeof err);
    if (ok) puts(output);
    else fprintf(stderr, "cvgen-c: %s\n", err);

    pdf_free(&pdf);
    arena_free(&arena);
    return ok ? 0 : 1;
}
