defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_cookies
    plug CatatanBackendWeb.Plugs.SessionPlug
  end

  pipeline :authenticated do
    plug CatatanBackendWeb.Plugs.AuthPlug, required: true
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    scope "/v1" do
      resources "/notes", NotesController, only: [:index, :show, :create, :update]

      # Session management routes
      get "/sessions", SessionsController, :index
      put "/sessions/:id/activate", SessionsController, :activate

      # Share routes - public access
      post "/shares", SharesController, :create
      get "/shares/:id", SharesController, :show
    end

    # Protected routes requiring authentication
    scope "/v1" do
      pipe_through :authenticated

      # Profile route
      get "/profile", ProfileController, :show

      # Share management routes - requires authentication
      get "/shares/:id/info", SharesController, :info
      put "/shares/:id/permissions", SharesController, :update_permissions
    end
  end

  # Enable Swoosh mailbox preview in development
  if Application.compile_env(:catatan_backend, :dev_routes) do
    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
