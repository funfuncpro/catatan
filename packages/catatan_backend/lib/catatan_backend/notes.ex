defmodule CatatanBackend.Notes do
  alias CatatanBackend.GenerateID
  alias CatatanBackend.Notes.Create

  @moduledoc """
  Public module for Notes context in the CatatanBackend application.
  """

  @doc """
  Creates a new note with the given content.
  """
  @spec create_note(String.t()) :: {:ok, map()} | {:error, term()}
  def create_note(content) do
    IO.puts(content)

    Create.insert_created_note(
      content,
      GenerateID.generate_nano_id(),
      DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    )
  end
end
