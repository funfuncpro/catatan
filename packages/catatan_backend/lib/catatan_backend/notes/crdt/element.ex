defmodule CatatanBackend.Notes.Crdt.Element do
  @type id :: {writer_id :: String.t(), clock :: non_neg_integer()}

  @type t :: %__MODULE__{
          id: id(),
          origin: id() | nil,
          right_origin: id() | nil,
          content: String.t(),
          note_id: String.t(),
          deleted_at: String.t() | nil
        }

  defstruct [:id, :origin, :right_origin, :content, :deleted_at, :note_id]

  defimpl Jason.Encoder, for: CatatanBackend.Notes.Crdt.Element do
    def encode(element, opts) do
      element
      |> Map.from_struct()
      |> Map.update(:id, nil, &encode_id/1)
      |> Map.update(:origin, nil, &encode_id/1)
      |> Map.update(:right_origin, nil, &encode_id/1)
      |> Jason.Encode.map(opts)
    end

    defp encode_id(nil), do: nil
    defp encode_id({writer_id, clock}), do: [writer_id, clock]
  end

  @spec parse(map()) :: {:ok, t()} | {:error, String.t()}
  def parse(%{
        "id" => id,
        "origin" => origin,
        "right_origin" => right_origin,
        "content" => content
      }) do
    {:ok,
     %__MODULE__{
       id: parse_id(id),
       origin: parse_id(origin),
       right_origin: parse_id(right_origin),
       content: content,
       deleted_at: nil
     }}
  end

  def parse(_), do: {:error, "Invalid element format"}

  @spec parse_id(list() | nil) :: id() | nil
  defp parse_id(nil), do: nil

  defp parse_id([writer_id, clock]) when is_binary(writer_id) and is_integer(clock),
    do: {writer_id, clock}

  @spec encode_id(id() | nil) :: String.t() | nil
  def encode_id(nil), do: nil
  def encode_id({writer_id, clock}), do: "#{writer_id}:#{clock}"

  @spec decode_id(String.t() | nil) :: id() | nil
  def decode_id(nil), do: nil

  def decode_id(str) do
    [writer_id, clock] = String.split(str, ":")
    {writer_id, String.to_integer(clock)}
  end

  @spec merge_deleted(t, t) :: term()
  def merge_deleted(%__MODULE__{} = existing, %__MODULE__{} = incoming) do
    %{
      existing
      | deleted_at:
          case {existing.deleted_at, incoming.deleted_at} do
            {nil, nil} -> nil
            {nil, _} -> incoming.deleted_at
            {_, nil} -> existing.deleted_at
            {_, _} -> Enum.min([existing.deleted_at, incoming.deleted_at])
          end
    }
  end
end
