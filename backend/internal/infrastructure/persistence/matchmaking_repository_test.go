package persistence

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // use a dedicated DB for tests
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}
	return rdb
}

func cleanupKeys(t *testing.T, rdb *redis.Client, keys ...string) {
	t.Helper()
	ctx := context.Background()
	for _, k := range keys {
		rdb.Del(ctx, k)
	}
}

func TestMatchmakingRepository_EnqueueAndDequeue(t *testing.T) {
	rdb := setupTestRedis(t)
	defer cleanupKeys(t, rdb, matchmakingQueueKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	id1 := uuid.New()
	id2 := uuid.New()

	require.NoError(t, repo.Enqueue(ctx, id1))
	require.NoError(t, repo.Enqueue(ctx, id2))

	first, second, err := repo.Dequeue(ctx)
	require.NoError(t, err)
	assert.Equal(t, id1, first, "FIFO: first enqueued should be dequeued first")
	assert.Equal(t, id2, second, "FIFO: second enqueued should be dequeued second")
}

func TestMatchmakingRepository_Dequeue_Empty(t *testing.T) {
	rdb := setupTestRedis(t)
	defer cleanupKeys(t, rdb, matchmakingQueueKey)
	// Ensure queue is empty
	rdb.Del(context.Background(), matchmakingQueueKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	first, second, err := repo.Dequeue(ctx)
	require.NoError(t, err)
	assert.Equal(t, uuid.Nil, first)
	assert.Equal(t, uuid.Nil, second)
}

func TestMatchmakingRepository_Dequeue_OnlyOneInQueue(t *testing.T) {
	rdb := setupTestRedis(t)
	defer cleanupKeys(t, rdb, matchmakingQueueKey)
	rdb.Del(context.Background(), matchmakingQueueKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	id1 := uuid.New()
	require.NoError(t, repo.Enqueue(ctx, id1))

	first, second, err := repo.Dequeue(ctx)
	require.NoError(t, err)
	assert.Equal(t, uuid.Nil, first, "should return Nil when only one in queue")
	assert.Equal(t, uuid.Nil, second)

	// Verify the single user was pushed back (rollback)
	val, err := rdb.LPop(ctx, matchmakingQueueKey).Result()
	require.NoError(t, err)
	assert.Equal(t, id1.String(), val, "single user should be pushed back to queue")
}

func TestMatchmakingRepository_SetActive_First(t *testing.T) {
	rdb := setupTestRedis(t)
	userID := uuid.New()
	activeKey := matchmakingActiveKey + userID.String()
	defer cleanupKeys(t, rdb, activeKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	ok, err := repo.SetActive(ctx, userID)
	require.NoError(t, err)
	assert.True(t, ok, "first SetActive should succeed")
}

func TestMatchmakingRepository_SetActive_Duplicate(t *testing.T) {
	rdb := setupTestRedis(t)
	userID := uuid.New()
	activeKey := matchmakingActiveKey + userID.String()
	defer cleanupKeys(t, rdb, activeKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	ok, err := repo.SetActive(ctx, userID)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = repo.SetActive(ctx, userID)
	require.NoError(t, err)
	assert.False(t, ok, "duplicate SetActive should return false")
}

func TestMatchmakingRepository_ClearActiveAndReSetActive(t *testing.T) {
	rdb := setupTestRedis(t)
	userID := uuid.New()
	activeKey := matchmakingActiveKey + userID.String()
	defer cleanupKeys(t, rdb, activeKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	ok, err := repo.SetActive(ctx, userID)
	require.NoError(t, err)
	require.True(t, ok)

	require.NoError(t, repo.ClearActive(ctx, userID))

	ok, err = repo.SetActive(ctx, userID)
	require.NoError(t, err)
	assert.True(t, ok, "SetActive should succeed after ClearActive")
}

func TestMatchmakingRepository_Remove(t *testing.T) {
	rdb := setupTestRedis(t)
	defer cleanupKeys(t, rdb, matchmakingQueueKey)
	rdb.Del(context.Background(), matchmakingQueueKey)

	repo := NewMatchmakingRepository(rdb)
	ctx := context.Background()

	id1 := uuid.New()
	id2 := uuid.New()
	require.NoError(t, repo.Enqueue(ctx, id1))
	require.NoError(t, repo.Enqueue(ctx, id2))

	require.NoError(t, repo.Remove(ctx, id1))

	// Only id2 should remain
	val, err := rdb.LPop(ctx, matchmakingQueueKey).Result()
	require.NoError(t, err)
	assert.Equal(t, id2.String(), val)

	// Queue should be empty now
	_, err = rdb.LPop(ctx, matchmakingQueueKey).Result()
	assert.Equal(t, redis.Nil, err)
}
