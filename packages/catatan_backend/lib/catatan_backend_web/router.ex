defmodule CatatanBackendWeb.Router do
  use CatatanBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", CatatanBackendWeb do
    pipe_through :api

    scope "/v1" do
      resources "/notes", NotesController, only: [:index, :show, :create, :update]
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
