defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_cookies
    plug CatatanBackendWeb.Plugs.SessionPlug
  end

  pipeline :internal_api do
    plug :accepts, ["json"]
    plug CatatanBackendWeb.Plugs.ApiKey
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    scope "/v1" do
      resources "/notes", NotesController, only: [:show, :create]

      # Session management routes
      get "/sessions", SessionsController, :index
      put "/sessions/:id/activate", SessionsController, :activate

      # Share routes
      post "/shares", SharesController, :create
      resources "/shares", SharesController, only: [:show]
    end
  end

  scope "/internal", CatatanBackendWeb do
    pipe_through :internal_api

    scope "/v1" do
      resources "/email", EmailController, only: [:index]
    end
  end
end
