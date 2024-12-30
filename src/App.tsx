import { useCallback, useContext, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Outlet, useNavigate } from 'react-router-dom'
import { SPOTIFY_AUTH_CHECK_MS } from './config'
import {
  KeyboardProvider,
  SocketContext,
  SpotifyPlayerProvider,
  Theme,
} from './context'
import { CurrentlyPlayingProvider } from './context/CurrentlyPlayingContext'
import {
  authenticateLink,
  checkLinkAuth,
  fetchCurrentClubInfo,
  fetchCurrentlyPlaying,
  fetchJukeboxes,
  fetchNextTracks,
  fetchUserInfo,
  initializeUser,
  logoutUser,
  selectCurrentJukebox,
  selectSpotifyAuth,
  selectUser,
  selectUserLoggedIn,
  setAllClubs,
  setCurrentClub,
  setPlayerState,
} from './store'

export const App = () => {
  const userIsLoggedIn = useSelector(selectUserLoggedIn)
  const userInfo = useSelector(selectUser)
  const spotifyAuth = useSelector(selectSpotifyAuth)
  const currentJukebox = useSelector(selectCurrentJukebox)

  const {
    emitMessage,
    onEvent,
    isConnected: socketIsConnected,
  } = useContext(SocketContext)

  const navigate = useNavigate()

  /**
   * =================== *
   * User Authentication *
   * =================== *
   */
  // Initialization actions
  useEffect(() => {
    initializeUser()
  }, [])

  // Triggers when login status changes
  useEffect(() => {
    if (userIsLoggedIn === false) {
      navigate('/auth/admin/login')
    } else if (userIsLoggedIn) {
      // Store new user info
      fetchUserInfo().then(async (resUserInfo) => {
        if (!resUserInfo) return

        setCurrentClub(resUserInfo.clubs[0])
        setAllClubs(resUserInfo.clubs)
        await fetchCurrentClubInfo()
        await fetchJukeboxes()
      })
    } else if (userInfo || userIsLoggedIn === false) {
      logoutUser()
    }
  }, [userIsLoggedIn])

  /**
   * ======================== *
   * Spotify Track State Sync *
   * ======================== *
   */

  // Triggers when receive spotify credentials from server
  useEffect(() => {
    if (!spotifyAuth) return

    const timer = setInterval(() => {
      checkLinkAuth().then(() => {
        console.log('Refreshed spotify token')
      })
    }, SPOTIFY_AUTH_CHECK_MS)

    return () => clearInterval(timer)
  }, [spotifyAuth])

  // Triggers when the current jukebox changes
  useEffect(() => {
    if (currentJukebox) {
      fetchCurrentlyPlaying().then((res) => {
        console.log('Currently playing:', res)
      })
      fetchNextTracks().then(() => {})
    }
  }, [currentJukebox])

  // Receives track updates from server, updates store
  useEffect(() => {
    authenticateLink().then()
    onEvent<IPlayerUpdate>('track-state-update', (data) => {
      setPlayerState(data)

      if (data.next_tracks) {
        // setNextTracks(data.next_tracks)
      }
    })
  }, [currentJukebox, socketIsConnected])

  // Primary function that runs when Spotify Player changes
  const handlePlayerTrackChange = useCallback(
    (state: {
      currentTrack: ITrack
      position: number
      isPlaying: boolean
      nextTracks: ITrack[]
    }) => {
      const { currentTrack, position, isPlaying, nextTracks } = state

      emitMessage<IPlayerAuxUpdate>('player-aux-update', {
        jukebox_id: currentJukebox!.id,
        current_track: currentTrack,
        progress: position,
        is_playing: isPlaying,
        default_next_tracks: nextTracks,
      })
    },
    [currentJukebox],
  )

  return (
    <Theme>
      <KeyboardProvider>
        <SpotifyPlayerProvider
          token={spotifyAuth?.access_token}
          jukebox={currentJukebox}
          onPlayerStateChange={handlePlayerTrackChange}
        >
          <CurrentlyPlayingProvider>
            <Outlet />
          </CurrentlyPlayingProvider>
        </SpotifyPlayerProvider>
      </KeyboardProvider>
    </Theme>
  )
}
