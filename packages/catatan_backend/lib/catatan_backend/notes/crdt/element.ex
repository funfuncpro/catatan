defmodule CatatanBackend.Notes.Crdt.Element do
  @type id :: {site_id :: String.t(), clock :: non_neg_integer()}

  @type t :: %__MODULE__{
          id: id(),
          origin: id() | nil,
          right_origin: id() | nil,
          content: String.t(),
          deleted_at: String.t() | nil
        }

  @derive Jason.Encoder
  defstruct [:id, :origin, :right_origin, :content, :deleted_at]

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

  def parse(_), do: {:error, :invalid_element}

  defp parse_id(nil), do: nil

  defp parse_id([site_id, clock]), do: {site_id, clock}

  defp parse_id(str) when is_binary(str) do
    [site_id, clock] = String.split(str, "-")
    {site_id, String.to_integer(clock)}
  end
end
