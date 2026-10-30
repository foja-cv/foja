/* The CV resolved for one profile: data/cv.json plus data/perfiles/<profile>.json. */
#ifndef CV_CV_H
#define CV_CV_H

#include "json.h"
#include "text.h"

typedef struct {
    const char *title, *place, *period, *note; /* UTF-8, "" when absent */
    Item *tasks;
    size_t ntasks;
} Entry;

typedef struct {
    const char *title;
    Entry *entries;
    size_t nentries;
    Item *items;
    size_t nitems;
    bool compact; /* entries without tasks */
    bool side;    /* drawn in the sidebar instead of the main column */
} Section;

typedef struct {
    const char *title;
    const char **lines;
    size_t nlines;
    bool paired; /* drawn on the left of the next block, in the same row */
} SideBlock;

typedef struct {
    const char *name, *subtitle, *profile, *photo;
    SideBlock *side;
    size_t nside;
    Section *sections;
    size_t nsections;
} Cv;

/* private_path holds the address (NULL: <data_dir>/privado.json); it is only read when the
   profile has "domicilio": true. */
bool cv_build(Arena *arena, const char *data_dir, const char *private_path, const char *profile,
              Cv *cv, char *err, size_t errlen);

/* "desde" alone is one date, "hasta": null means ongoing. "" without dates, NULL on error. */
const char *cv_format_period(Arena *arena, const Json *raw, char *err, size_t errlen);

#endif
