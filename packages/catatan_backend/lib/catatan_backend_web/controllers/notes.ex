defmodule CatatanBackendWeb.NotesController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.Response

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
