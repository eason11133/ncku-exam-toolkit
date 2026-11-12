#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

/* Decode unsigned 32-bit big-endian field. No alignment assumption. */
static bool read_be_u32(const uint8_t *buf, size_t len, size_t offset,
                        uint32_t *out) {
    if (buf == NULL || out == NULL || offset > len || len - offset < 4)
        return false;
    *out = ((uint32_t)buf[offset] << 24) |
           ((uint32_t)buf[offset + 1] << 16) |
           ((uint32_t)buf[offset + 2] << 8) |
            (uint32_t)buf[offset + 3];
    return true;
}

int main(void) {
    const uint8_t bytes[] = {0xFF, 0x12, 0x34, 0x56, 0x78};
    uint32_t value = 0;
    assert(read_be_u32(bytes, sizeof bytes, 1, &value));
    assert(value == UINT32_C(0x12345678));
    assert(!read_be_u32(bytes, sizeof bytes, 2, &value));
    assert(!read_be_u32(bytes, sizeof bytes, SIZE_MAX, &value));
    puts("parse OK");
    return 0;
}
