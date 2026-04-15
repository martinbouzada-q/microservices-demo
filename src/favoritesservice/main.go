// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	pb "github.com/GoogleCloudPlatform/microservices-demo/src/frontend/genproto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const port = "50052"

// FavoritesService implements the FavoritesService gRPC service
type FavoritesService struct {
	pb.UnimplementedFavoritesServiceServer
	mu        sync.RWMutex
	favorites map[string][]*pb.Favorite // userID -> list of favorites
}

// AddFavorite adds a product to user's favorites (idempotent)
func (s *FavoritesService) AddFavorite(ctx context.Context, req *pb.AddFavoriteRequest) (*pb.Empty, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	if req.ProductId == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.favorites[req.UserId] == nil {
		s.favorites[req.UserId] = []*pb.Favorite{}
	}

	// Check if product already exists (idempotent)
	for _, fav := range s.favorites[req.UserId] {
		if fav.ProductId == req.ProductId {
			return &pb.Empty{}, nil // Already exists, return success
		}
	}

	// Add new favorite
	favorite := &pb.Favorite{
		ProductId: req.ProductId,
		AddedAt:   time.Now().Format(time.RFC3339),
	}
	s.favorites[req.UserId] = append(s.favorites[req.UserId], favorite)

	log.Printf("Added favorite: user=%s product=%s", req.UserId, req.ProductId)
	return &pb.Empty{}, nil
}

// GetFavorites returns all favorites for a user
func (s *FavoritesService) GetFavorites(ctx context.Context, req *pb.GetFavoritesRequest) (*pb.GetFavoritesResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	favorites := s.favorites[req.UserId]
	if favorites == nil {
		favorites = []*pb.Favorite{}
	}

	return &pb.GetFavoritesResponse{
		Favorites: favorites,
	}, nil
}

// RemoveFavorite removes a product from user's favorites (idempotent)
func (s *FavoritesService) RemoveFavorite(ctx context.Context, req *pb.RemoveFavoriteRequest) (*pb.Empty, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	if req.ProductId == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.favorites[req.UserId] == nil {
		return &pb.Empty{}, nil // Nothing to remove
	}

	// Remove matching product
	filtered := []*pb.Favorite{}
	for _, fav := range s.favorites[req.UserId] {
		if fav.ProductId != req.ProductId {
			filtered = append(filtered, fav)
		}
	}
	s.favorites[req.UserId] = filtered

	log.Printf("Removed favorite: user=%s product=%s", req.UserId, req.ProductId)
	return &pb.Empty{}, nil
}

// ClearFavorites removes all favorites for a user
func (s *FavoritesService) ClearFavorites(ctx context.Context, req *pb.ClearFavoritesRequest) (*pb.Empty, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.favorites, req.UserId)
	log.Printf("Cleared favorites: user=%s", req.UserId)
	return &pb.Empty{}, nil
}

func main() {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterFavoritesServiceServer(s, &FavoritesService{
		favorites: make(map[string][]*pb.Favorite),
	})

	log.Printf("🎉 FavoritesService listening on port %s", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
