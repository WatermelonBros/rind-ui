// Avatar's machine is the shared image status machine (image-loading-status "Shared Machine
// Location"): an alias, so Image reuses the same definition without a move.

export {
  type ImageStatus as AvatarStatus,
  type ImageStatusEvent as AvatarEvent,
  type ImageStatusMachine as AvatarMachine,
  type ImageStatusProps as AvatarProps,
  imageStatusMachine as avatarMachine,
} from "../image-status/image-status.machine"
