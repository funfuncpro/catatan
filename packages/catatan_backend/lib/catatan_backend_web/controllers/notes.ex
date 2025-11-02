defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.NotesValidator
  alias CatatanBackendWeb.Response
  alias CatatanBackend.Notes

  action_fallback CatatanBackendWeb.FallbackController

  def create(conn, params) do
    case NotesValidator.validate_notes_creation(params) do
      {:ok, validated_data} ->
        with {:ok, note} <- Notes.create_note(Map.get(validated_data, :content, "")) do
          conn
          |> put_status(:created)
          |> Response.success_response("Note created successfully", note)
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end

  def update(conn, params) do
    IO.inspect(params)

    case NotesValidator.validate_notes_update(params) do
      {:ok, validated_data} ->
        with {:ok, note} <-
               Notes.update_note_by_id(validated_data.id, Map.get(validated_data, :content, "")) do
          conn
          |> put_status(:ok)
          |> Response.success_response("Note updated successfully", note)
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end
end
