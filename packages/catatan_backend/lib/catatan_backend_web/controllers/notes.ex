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

  def index(conn, _params) do
    case CatatanBackend.Notes.All.all() do
      {:ok, notes} ->
        Response.success_response(conn, "success", %{notes: notes})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> Response.error_response("internal server error", %{})
    end
  end

  def show(conn, %{"id" => note_id}) do
    case CatatanBackend.Notes.Get.by_id(note_id) do
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
