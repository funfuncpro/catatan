defmodule CatatanBackend.Notes.Update do
  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Notes.Get

  @moduledoc """
  Internal Module responsible for updating notes in the CatatanBackend application.
  """

  @doc """
  Updates an existing note using select-then-update pattern.
  """

  @spec update_note(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def update_note(note_id, new_content) do
    case Get.by_id(note_id) do
      {:ok, existing_note} ->
        with {:ok, prepared} <-
               CassandraClient.prepare(
                 "UPDATE notes_by_id SET content = :content, updated_at = :updated_at WHERE note_id = :id"
               ),
             {:ok, _result} <-
               CassandraClient.execute(prepared, %{
                 "id" => existing_note["note_id"],
                 "content" => new_content,
                 "updated_at" => DateTime.utc_now() |> DateTime.to_unix(:millisecond)
               }) do
          {:ok,
           %{
             "note_id" => existing_note["note_id"],
             "content" => new_content
           }}
        end

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end
end
