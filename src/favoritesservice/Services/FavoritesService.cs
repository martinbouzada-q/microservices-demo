using Grpc.Core;
using FavoritesService.Models;
using FavoritesService.Stores;
using Hipstershop;

namespace FavoritesService.Services;

/// <summary>
/// gRPC service for managing user favorites (wishlist).
/// Implements FavoritesService from protos/demo.proto
/// </summary>
public class FavoritesServiceImpl : Hipstershop.FavoritesService.FavoritesServiceBase
{
    private readonly IFavoritesStore _store;
    private readonly ILogger<FavoritesServiceImpl> _logger;

    public FavoritesServiceImpl(IFavoritesStore store, ILogger<FavoritesServiceImpl> logger)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Add a product to user's wishlist.
    /// Idempotent: adding same product multiple times is safe (no duplicates).
    /// </summary>
    public override async Task<Empty> AddFavorite(AddFavoriteRequest request, ServerCallContext context)
    {
        _logger.LogInformation("AddFavorite called: userId={userId}, productId={productId}", request.UserId, request.ProductId);

        if (string.IsNullOrEmpty(request.UserId))
        {
            _logger.LogWarning("AddFavorite: empty userId");
            throw new RpcException(new Status(StatusCode.InvalidArgument, "user_id is required"));
        }

        if (string.IsNullOrEmpty(request.ProductId))
        {
            _logger.LogWarning("AddFavorite: empty productId for userId={userId}", request.UserId);
            throw new RpcException(new Status(StatusCode.InvalidArgument, "product_id is required"));
        }

        try
        {
            await _store.AddAsync(request.UserId, request.ProductId);
            return new Empty();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AddFavorite failed: userId={userId}, productId={productId}", request.UserId, request.ProductId);
            throw new RpcException(new Status(StatusCode.Internal, "Failed to add favorite"));
        }
    }

    /// <summary>
    /// Get all products in user's wishlist, sorted by most recently added (newest first).
    /// </summary>
    public override async Task<GetFavoritesResponse> GetFavorites(GetFavoritesRequest request, ServerCallContext context)
    {
        _logger.LogInformation("GetFavorites called: userId={userId}", request.UserId);

        if (string.IsNullOrEmpty(request.UserId))
        {
            _logger.LogWarning("GetFavorites: empty userId");
            throw new RpcException(new Status(StatusCode.InvalidArgument, "user_id is required"));
        }

        try
        {
            var favorites = await _store.GetAsync(request.UserId);

            var response = new GetFavoritesResponse();
            foreach (var fav in favorites)
            {
                response.Favorites.Add(new Hipstershop.Favorite
                {
                    ProductId = fav.ProductId,
                    AddedAt = fav.AddedAt
                });
            }

            _logger.LogInformation("GetFavorites returning {count} items for userId={userId}", favorites.Count, request.UserId);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetFavorites failed: userId={userId}", request.UserId);
            throw new RpcException(new Status(StatusCode.Internal, "Failed to retrieve favorites"));
        }
    }

    /// <summary>
    /// Remove a product from user's wishlist.
    /// Idempotent: removing non-existent product is safe (no error).
    /// </summary>
    public override async Task<Empty> RemoveFavorite(RemoveFavoriteRequest request, ServerCallContext context)
    {
        _logger.LogInformation("RemoveFavorite called: userId={userId}, productId={productId}", request.UserId, request.ProductId);

        if (string.IsNullOrEmpty(request.UserId))
        {
            _logger.LogWarning("RemoveFavorite: empty userId");
            throw new RpcException(new Status(StatusCode.InvalidArgument, "user_id is required"));
        }

        if (string.IsNullOrEmpty(request.ProductId))
        {
            _logger.LogWarning("RemoveFavorite: empty productId for userId={userId}", request.UserId);
            throw new RpcException(new Status(StatusCode.InvalidArgument, "product_id is required"));
        }

        try
        {
            await _store.RemoveAsync(request.UserId, request.ProductId);
            return new Empty();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RemoveFavorite failed: userId={userId}, productId={productId}", request.UserId, request.ProductId);
            throw new RpcException(new Status(StatusCode.Internal, "Failed to remove favorite"));
        }
    }

    /// <summary>
    /// Clear all products from user's wishlist.
    /// </summary>
    public override async Task<Empty> ClearFavorites(ClearFavoritesRequest request, ServerCallContext context)
    {
        _logger.LogInformation("ClearFavorites called: userId={userId}", request.UserId);

        if (string.IsNullOrEmpty(request.UserId))
        {
            _logger.LogWarning("ClearFavorites: empty userId");
            throw new RpcException(new Status(StatusCode.InvalidArgument, "user_id is required"));
        }

        try
        {
            await _store.ClearAsync(request.UserId);
            return new Empty();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ClearFavorites failed: userId={userId}", request.UserId);
            throw new RpcException(new Status(StatusCode.Internal, "Failed to clear favorites"));
        }
    }
}
