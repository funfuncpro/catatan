defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.NotesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Notes

  require Logger

  action_fallback CatatanBackendWeb.FallbackController

  @moduledoc """
  Controller for handling note-related API requests.

  Note: Updates should be done via WebSocket channels for real-time collaboration.
  """

  def create(conn, params) do
    {:ok, _validated_data} = NotesValidator.validate_notes_creation(params)

    # owner_id is nil for now (anonymous notes)
    case Notes.create_note(nil) do
      {:ok, note} ->
        conn
        |> put_status(:created)
        |> Response.success_response("Note created successfully", note)

      {:error, reason} ->
        Logger.error("Failed to create note: #{inspect(reason)}")

        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("Failed to create note", %{})
    end
  end

  @doc """
  Handles the API request to retrieve a single note by its ID.
  """
  def show(conn, %{"id" => note_id}) do
    case Notes.get_note_by_id(note_id) do
      {:ok, note} ->
        Response.success_response(conn, "success", note)

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> Response.error_response("not found", %{})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("internal server error", %{})
    end
  end
end
