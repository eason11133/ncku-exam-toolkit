#include <stdint.h>
#include <stdio.h>
#define N 6

typedef struct { int x, y, z; } Point;

int main(void) {
    const Point aos[N] = {
        {1, 100, 200}, {2, 100, 200}, {3, 100, 200},
        {4, 100, 200}, {5, 100, 200}, {6, 100, 200}
    };
    const int xs[N] = {1, 2, 3, 4, 5, 6};
    int64_t a = 0, b = 0;
    for (size_t i = 0; i < N; ++i) a += aos[i].x;
    for (size_t i = 0; i < N; ++i) b += xs[i];
    printf("AoS=%lld SoA=%lld\n", (long long)a, (long long)b);
    return a == b && a == 21 ? 0 : 1;
}
