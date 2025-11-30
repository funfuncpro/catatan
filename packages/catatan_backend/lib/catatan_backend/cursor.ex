defmodule CatatanBackend.Cursor do
  @moduledoc """
  Cursor position in a YATA-based CRDT document.

  Instead of storing x/y coordinates which become invalid after concurrent edits,
  we store the cursor position as a reference to a YATA element.

  The cursor is positioned "after" a specific element, or at the start of the
  document if `after_element` is nil.

  ## Fields
    - `after_element`: The element ID the cursor is positioned after, or nil for document start
    - `offset`: Character offset within the element (for elements with multi-char content), defaults to 0
  """

  alias CatatanBackend.Notes.Crdt.Element

  @type element_id :: Element.id() | nil

  @type t :: %__MODULE__{
          after_element: element_id(),
          offset: non_neg_integer()
        }

  defstruct after_element: nil, offset: 0

  defimpl Jason.Encoder, for: CatatanBackend.Cursor do
    def encode(cursor, opts) do
      %{
        after_element: encode_element_id(cursor.after_element),
        offset: cursor.offset
      }
      |> Jason.Encode.map(opts)
    end

    defp encode_element_id(nil), do: nil
    defp encode_element_id({writer_id, clock}), do: [writer_id, clock]
  end

  @spec initialize :: t
  def initialize do
    %__MODULE__{
      after_element: nil,
      offset: 0
    }
  end

  @doc """
  Sets the cursor position to be after a specific element.

  ## Parameters
    - cursor: The cursor struct
    - after_element: The element ID to position after, or nil for document start
    - offset: Character offset within the element (default 0)
  """
  @spec set_position(t, element_id(), non_neg_integer()) :: t
  def set_position(cursor, after_element, offset \\ 0) do
    %{cursor | after_element: after_element, offset: offset}
  end

  @doc """
  Encodes the cursor for JSON serialization (for broadcasting to clients).
  """
  @spec encode(t) :: map()
  def encode(%__MODULE__{} = cursor) do
    %{
      after_element: encode_element_id(cursor.after_element),
      offset: cursor.offset
    }
  end

  @doc """
  Decodes a cursor from client payload format.
  """
  @spec decode(map()) :: {:ok, t} | {:error, String.t()}
  def decode(%{"after_element" => after_element, "offset" => offset})
      when is_integer(offset) and offset >= 0 do
    case parse_element_id(after_element) do
      {:ok, parsed_id} ->
        {:ok, %__MODULE__{after_element: parsed_id, offset: offset}}

      {:error, _} = error ->
        error
    end
  end

  def decode(%{"after_element" => after_element}) do
    case parse_element_id(after_element) do
      {:ok, parsed_id} ->
        {:ok, %__MODULE__{after_element: parsed_id, offset: 0}}

      {:error, _} = error ->
        error
    end
  end

  def decode(_), do: {:error, "Invalid cursor format"}

  # Private helpers

  defp encode_element_id(nil), do: nil
  defp encode_element_id({writer_id, clock}), do: [writer_id, clock]

  defp parse_element_id(nil), do: {:ok, nil}

  defp parse_element_id([writer_id, clock])
       when is_binary(writer_id) and is_integer(clock) and clock >= 0 do
    {:ok, {writer_id, clock}}
  end

  defp parse_element_id(_), do: {:error, "Invalid element ID format"}
end
