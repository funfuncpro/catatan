defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    get "/v1/", HelloController, :index
    post "/v1/test-user", NotesController, :test_user
    get "/v1/test-user", NotesController, :get_test_user
    get "/v1/notes/:note_id", NotesController, :get_by_id
  end

  # Enable Swoosh mailbox preview in development
  if Application.compile_env(:catatan_backend, :dev_routes) do
    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
