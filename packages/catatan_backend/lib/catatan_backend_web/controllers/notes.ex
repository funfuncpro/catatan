defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.NotesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Notes

  action_fallback CatatanBackendWeb.FallbackController

  def create(conn, params) do
    case NotesValidator.validate_notes_creation(params) do
      {:ok, validated_data} ->
        case Notes.create_note(validated_data.content) do
          {:ok, note} ->
            conn
            |> put_status(:created)
            |> Response.success_response("Note created successfully", note)

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> Response.error_response("Failed to create note", %{reason: reason})
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end
end
