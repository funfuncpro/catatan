defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_cookies
  end

  pipeline :authenticated do
    plug CatatanBackendWeb.Plugs.AuthPlug, required: true
  end

  pipeline :internal_api do
    plug :accepts, ["json"]
    plug CatatanBackendWeb.Plugs.ApiKey
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    scope "/v1" do
      resources "/notes", NotesController, only: [:show, :create]

      # Share routes
      post "/shares", SharesController, :create
      resources "/shares", SharesController, only: [:show]
    end

    # Protected routes requiring authentication
    scope "/v1" do
      pipe_through :authenticated

      get "/profile", ProfileController, :show
      get "/test-auth", TestAuthController, :show
    end
  end

  scope "/internal", CatatanBackendWeb do
    pipe_through :internal_api

    scope "/v1" do
      resources "/email/verify", Email.VerifyController, only: [:create]
    end
  end
end
