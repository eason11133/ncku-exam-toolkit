#include <pthread.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>

#define CAPACITY 4
#define TOTAL 1000

typedef struct {
    int items[CAPACITY];
    size_t head, tail, count;
    bool closed;
    pthread_mutex_t mu;
    pthread_cond_t not_empty, not_full;
} Queue;

static Queue q = {
    .mu = PTHREAD_MUTEX_INITIALIZER,
    .not_empty = PTHREAD_COND_INITIALIZER,
    .not_full = PTHREAD_COND_INITIALIZER
};

static bool push(int value) {
    pthread_mutex_lock(&q.mu);
    while (q.count == CAPACITY && !q.closed)
        pthread_cond_wait(&q.not_full, &q.mu);
    if (q.closed) {
        pthread_mutex_unlock(&q.mu);
        return false;
    }
    q.items[q.tail] = value;
    q.tail = (q.tail + 1) % CAPACITY;
    ++q.count;
    pthread_cond_signal(&q.not_empty);
    pthread_mutex_unlock(&q.mu);
    return true;
}

static bool pop(int *result) {
    pthread_mutex_lock(&q.mu);
    while (q.count == 0 && !q.closed)
        pthread_cond_wait(&q.not_empty, &q.mu);
    if (q.count == 0) {
        pthread_mutex_unlock(&q.mu);
        return false; /* closed and drained */
    }
    *result = q.items[q.head];
    q.head = (q.head + 1) % CAPACITY;
    --q.count;
    pthread_cond_signal(&q.not_full);
    pthread_mutex_unlock(&q.mu);
    return true;
}

static void close_queue(void) {
    pthread_mutex_lock(&q.mu);
    q.closed = true;
    pthread_cond_broadcast(&q.not_empty);
    pthread_cond_broadcast(&q.not_full);
    pthread_mutex_unlock(&q.mu);
}

static void *producer(void *unused) {
    (void)unused;
    for (int i = 1; i <= TOTAL; ++i)
        if (!push(i)) break;
    close_queue();
    return NULL;
}

static void *consumer(void *result_ptr) {
    long long sum = 0;
    int value;
    while (pop(&value)) sum += value;
    *(long long *)result_ptr = sum; /* main reads only after pthread_join */
    return NULL;
}

int main(void) {
    pthread_t p, c;
    long long sum = 0;
    if (pthread_create(&c, NULL, consumer, &sum) != 0) return 1;
    if (pthread_create(&p, NULL, producer, NULL) != 0) {
        close_queue();
        pthread_join(c, NULL);
        return 1;
    }
    pthread_join(p, NULL);
    pthread_join(c, NULL);
    printf("sum=%lld\n", sum);
    return sum == (long long)TOTAL * (TOTAL + 1) / 2 ? 0 : 1;
}
