using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using FavoritesService.Models;
using FavoritesService.Services;
using FavoritesService.Stores;
using Grpc.Core;

namespace FavoritesService.Tests;

public class FavoritesServiceTests
{
    private readonly Mock<IFavoritesStore> _mockStore;
    private readonly Mock<ILogger<FavoritesServiceImpl>> _mockLogger;
    private readonly FavoritesServiceImpl _service;

    public FavoritesServiceTests()
    {
        _mockStore = new Mock<IFavoritesStore>();
        _mockLogger = new Mock<ILogger<FavoritesServiceImpl>>();
        _service = new FavoritesServiceImpl(_mockStore.Object, _mockLogger.Object);
    }

    #region AddFavorite Tests

    [Fact]
    public async Task AddFavorite_WithValidInput_CallsStore()
    {
        // Arrange
        var userId = "test-session-123";
        var productId = "OLJCESPC7Z";
        var request = new Hipstershop.AddFavoriteRequest
        {
            UserId = userId,
            ProductId = productId
        };

        // Act
        await _service.AddFavorite(request, null!);

        // Assert
        _mockStore.Verify(s => s.AddAsync(userId, productId), Times.Once);
    }

    [Fact]
    public async Task AddFavorite_WithEmptyUserId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.AddFavoriteRequest
        {
            UserId = "",
            ProductId = "OLJCESPC7Z"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.AddFavorite(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    [Fact]
    public async Task AddFavorite_WithEmptyProductId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.AddFavoriteRequest
        {
            UserId = "test-session-123",
            ProductId = ""
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.AddFavorite(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    [Fact]
    public async Task AddFavorite_WhenStoreThrows_ReturnsInternalError()
    {
        // Arrange
        var request = new Hipstershop.AddFavoriteRequest
        {
            UserId = "test-session-123",
            ProductId = "OLJCESPC7Z"
        };
        _mockStore.Setup(s => s.AddAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("Redis connection failed"));

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.AddFavorite(request, null!));
        Assert.Equal(StatusCode.Internal, ex.Status.StatusCode);
    }

    #endregion

    #region GetFavorites Tests

    [Fact]
    public async Task GetFavorites_WithValidInput_ReturnsFavorites()
    {
        // Arrange
        var userId = "test-session-123";
        var request = new Hipstershop.GetFavoritesRequest { UserId = userId };

        var favorites = new List<Favorite>
        {
            new() { ProductId = "OLJCESPC7Z", AddedAt = DateTime.UtcNow.ToString("O") },
            new() { ProductId = "66VCHSJNUP", AddedAt = DateTime.UtcNow.AddMinutes(-5).ToString("O") }
        };
        _mockStore.Setup(s => s.GetAsync(userId))
            .ReturnsAsync(favorites);

        // Act
        var response = await _service.GetFavorites(request, null!);

        // Assert
        Assert.Equal(2, response.Favorites.Count);
        Assert.Equal("OLJCESPC7Z", response.Favorites[0].ProductId);
        _mockStore.Verify(s => s.GetAsync(userId), Times.Once);
    }

    [Fact]
    public async Task GetFavorites_WithEmptyUserId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.GetFavoritesRequest { UserId = "" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.GetFavorites(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    [Fact]
    public async Task GetFavorites_WithEmptyWishlist_ReturnsEmptyList()
    {
        // Arrange
        var userId = "test-session-empty";
        var request = new Hipstershop.GetFavoritesRequest { UserId = userId };
        _mockStore.Setup(s => s.GetAsync(userId))
            .ReturnsAsync(new List<Favorite>());

        // Act
        var response = await _service.GetFavorites(request, null!);

        // Assert
        Assert.Empty(response.Favorites);
    }

    [Fact]
    public async Task GetFavorites_WhenStoreThrows_ReturnsInternalError()
    {
        // Arrange
        var request = new Hipstershop.GetFavoritesRequest { UserId = "test-session-123" };
        _mockStore.Setup(s => s.GetAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("Redis connection failed"));

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.GetFavorites(request, null!));
        Assert.Equal(StatusCode.Internal, ex.Status.StatusCode);
    }

    #endregion

    #region RemoveFavorite Tests

    [Fact]
    public async Task RemoveFavorite_WithValidInput_CallsStore()
    {
        // Arrange
        var userId = "test-session-123";
        var productId = "OLJCESPC7Z";
        var request = new Hipstershop.RemoveFavoriteRequest
        {
            UserId = userId,
            ProductId = productId
        };

        // Act
        await _service.RemoveFavorite(request, null!);

        // Assert
        _mockStore.Verify(s => s.RemoveAsync(userId, productId), Times.Once);
    }

    [Fact]
    public async Task RemoveFavorite_WithEmptyUserId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.RemoveFavoriteRequest
        {
            UserId = "",
            ProductId = "OLJCESPC7Z"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.RemoveFavorite(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    [Fact]
    public async Task RemoveFavorite_WithEmptyProductId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.RemoveFavoriteRequest
        {
            UserId = "test-session-123",
            ProductId = ""
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.RemoveFavorite(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    #endregion

    #region ClearFavorites Tests

    [Fact]
    public async Task ClearFavorites_WithValidInput_CallsStore()
    {
        // Arrange
        var userId = "test-session-123";
        var request = new Hipstershop.ClearFavoritesRequest { UserId = userId };

        // Act
        await _service.ClearFavorites(request, null!);

        // Assert
        _mockStore.Verify(s => s.ClearAsync(userId), Times.Once);
    }

    [Fact]
    public async Task ClearFavorites_WithEmptyUserId_ThrowsException()
    {
        // Arrange
        var request = new Hipstershop.ClearFavoritesRequest { UserId = "" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<RpcException>(async () =>
            await _service.ClearFavorites(request, null!));
        Assert.Equal(StatusCode.InvalidArgument, ex.Status.StatusCode);
    }

    #endregion
}

public class RedisStoreTests
{
    // Note: Integration tests for RedisStore would require a real Redis instance.
    // Unit tests mock the IConnectionMultiplexer dependency.
    // See: https://github.com/StackExchange/StackExchange.Redis/wiki/Unit-Testing
}
