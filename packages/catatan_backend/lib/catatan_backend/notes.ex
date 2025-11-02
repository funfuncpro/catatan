defmodule CatatanBackend.Notes do
  alias CatatanBackend.GenerateID
  alias CatatanBackend.Notes.Create
  alias CatatanBackend.Notes.Update
  alias CatatanBackend.Notes.Get

  @moduledoc """
  Public module for Notes context in the CatatanBackend application.
  """

  @doc """
  Creates a new note with the given content.
  """
  @spec create_note(String.t()) :: {:ok, map()} | {:error, term()}
  def create_note(content) do
    Create.insert_created_note(
      content,
      GenerateID.generate_nano_id(),
      DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    )
  end

  @doc """
  Updates an existing note with new content.
  """
  @spec update_note_by_id(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def update_note_by_id(note_id, new_content) do
    Update.update_note(note_id, new_content)
  end

  @doc """
  Retrieves a note by its ID.
  """
  @spec get_note_by_id(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_note_by_id(note_id) do
    Get.by_id(note_id)
  end
end
