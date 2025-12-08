defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_cookies
  end

  pipeline :authenticated do
    plug CatatanBackendWeb.Plugs.AuthPlug, required: true
  end

  pipeline :maybe_authenticated do
    plug :accepts, ["json"]
    plug :fetch_cookies
    plug CatatanBackendWeb.Plugs.AuthPlug, required: false
  end

  pipeline :internal_api do
    plug :accepts, ["json"]
    plug CatatanBackendWeb.Plugs.ApiKey
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    # Public routes (no auth check needed at all, but maybe_authenticated handles it gracefully)
    scope "/v1" do
      pipe_through :maybe_authenticated
      resources "/notes", NotesController, only: [:show, :create]
      resources "/shares", SharesController, only: [:show, :create]
    end

    # Protected routes requiring authentication
    scope "/v1" do
      pipe_through :authenticated

      get "/profile", ProfileController, :show
      get "/test-auth", TestAuthController, :show
      post "/notes/:id/claim", NotesController, :claim
    end
  end

  scope "/internal", CatatanBackendWeb do
    pipe_through :internal_api

    scope "/v1" do
      resources "/email/verify", Email.VerifyController, only: [:create]
    end
  end
end
