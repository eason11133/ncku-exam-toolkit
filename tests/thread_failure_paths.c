/* Self-contained POSIX/C11 test: injected second create failure and fake join
 * failure illustrate cleanup and || short-circuit. No real pthread_join
 * failure induced; fake join only checks C control-flow. */
#include <pthread.h>
#include <stdbool.h>
#include <errno.h>
#include <stdio.h>

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static bool closed;
static int finished;
static int attempted;

static void *worker(void *arg) {
    (void)arg;
    if (pthread_mutex_lock(&mu) != 0) return (void *)1;
    while (!closed) {
        if (pthread_cond_wait(&cv, &mu) != 0) {
            (void)pthread_mutex_unlock(&mu);
            return (void *)1;
        }
    }
    ++finished;
    if (pthread_mutex_unlock(&mu) != 0) return (void *)1;
    return NULL;
}
static int injected_create(pthread_t *thr) {
    if (++attempted == 2) return EAGAIN; /* forced failure, no thread created */
    return pthread_create(thr, NULL, worker, NULL);
}
static int join_seen[2];
static int fake_join(int i) {
    ++join_seen[i];
    return i == 0 ? EINVAL : 0;
}
int main(void) {
    pthread_t one, two;
    if (injected_create(&one) != 0) return 1;
    if (injected_create(&two) != EAGAIN) return 2;
    /* Correct handling: wake and join the first thread, do not join `two`. */
    if (pthread_mutex_lock(&mu) != 0) return 3;
    closed = true;
    int signal_rc = pthread_cond_broadcast(&cv);
    int unlock_rc = pthread_mutex_unlock(&mu);
    if (signal_rc != 0 || unlock_rc != 0) return 4;
    void *retval = NULL;
    if (pthread_join(one, &retval) != 0 || retval != NULL) return 5;
    if (finished != 1) return 6;

    /* This proves the branch bug, not a real pthread_join failure. */
    join_seen[0] = join_seen[1] = 0;
    int old_result = (fake_join(0) != 0 || fake_join(1) != 0);
    if (!old_result || join_seen[0] != 1 || join_seen[1] != 0) return 7;
    join_seen[0] = join_seen[1] = 0;
    int ja = fake_join(0), jb = fake_join(1);
    if (ja != EINVAL || jb != 0 || join_seen[0] != 1 || join_seen[1] != 1) return 8;
    puts("create failure cleanup & join short-circuit PASS");
    return 0;
}
