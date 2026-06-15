/* global jQuery, DNW */
( function ( $ ) {
	'use strict';

	function post( action, data ) {
		return $.post(
			DNW.ajaxUrl,
			$.extend( { action: action, nonce: DNW.nonce }, data || {} )
		);
	}

	function setStatus( $el, msg, state ) {
		$el.removeClass( 'is-working is-success is-error' );
		if ( state ) {
			$el.addClass( 'is-' + state );
		}
		$el.html( msg );
	}

	$( function () {
		var $status = $( '#dnw-status' );

		// Generate now.
		$( '#dnw-generate' ).on( 'click', function () {
			var $btn  = $( this );
			var topic = $( '#dnw-topic' ).val();

			$btn.prop( 'disabled', true );
			setStatus( $status, '<span class="spinner is-active" style="float:none;margin:0 6px 0 0;"></span>' + DNW.i18n.working, 'working' );

			post( 'dnw_generate_now', { topic: topic } )
				.done( function ( res ) {
					if ( res && res.success ) {
						var seo = res.data.seoScore ? ' (SEO ' + res.data.seoScore + ')' : '';
						setStatus(
							$status,
							res.data.message + seo + ' — <a href="' + res.data.editLink + '">Edit draft</a>',
							'success'
						);
					} else {
						setStatus( $status, ( res.data && res.data.message ) || DNW.i18n.error, 'error' );
					}
				} )
				.fail( function () {
					setStatus( $status, DNW.i18n.error, 'error' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		// Preview news.
		$( '#dnw-preview-news' ).on( 'click', function () {
			var $btn     = $( this );
			var $preview = $( '#dnw-news-preview' );
			$btn.prop( 'disabled', true );
			$preview.html( '<p><span class="spinner is-active" style="float:none;margin:0 6px 0 0;"></span>Loading…</p>' );

			post( 'dnw_preview_news' )
				.done( function ( res ) {
					if ( res && res.success && res.data.items.length ) {
						var html = '<ul>';
						res.data.items.forEach( function ( it ) {
							html += '<li><a href="' + it.link + '" target="_blank" rel="noopener">' +
								$( '<div>' ).text( it.title ).html() + '</a>' +
								'<div class="src">' + $( '<div>' ).text( it.source ).html() + '</div></li>';
						} );
						html += '</ul>';
						$preview.html( html );
					} else if ( res && res.success ) {
						$preview.html( '<p>No new dental news found right now.</p>' );
					} else {
						$preview.html( '<p>' + ( ( res.data && res.data.message ) || DNW.i18n.error ) + '</p>' );
					}
				} )
				.fail( function () {
					$preview.html( '<p>' + DNW.i18n.error + '</p>' );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		// Rebuild voice profile.
		$( '#dnw-refresh-voice' ).on( 'click', function () {
			var $btn = $( this );
			var $s   = $( '#dnw-voice-status' );
			$btn.prop( 'disabled', true );
			$s.text( 'Analysing…' );

			post( 'dnw_refresh_voice' )
				.done( function ( res ) {
					$s.text( ( res && res.success ) ? res.data.message : DNW.i18n.error );
				} )
				.fail( function () {
					$s.text( DNW.i18n.error );
				} )
				.always( function () {
					$btn.prop( 'disabled', false );
				} );
		} );

		// Clear log.
		$( '#dnw-clear-log' ).on( 'click', function () {
			var $btn = $( this );
			$btn.prop( 'disabled', true );
			post( 'dnw_clear_log' ).done( function () {
				window.location.reload();
			} );
		} );
	} );
} )( jQuery );
