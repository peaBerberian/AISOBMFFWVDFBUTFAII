# AISOBMFFWVDFBUTFAII ##########################################################

**A**n **ISOBMFF** **W**eb **V**isualizer **D**one **F**or **B**etter
**U**nderstanding **T**he **F**ormat **A**nd **I**ts **I**ntricacies is a
web-based ISOBMFF file inspector, also usable as an MP4 box / fragmented MP4
analyzer.

You can test it [here](https://peaberberian.github.io/AISOBMFFWVDFBUTFAII/).

It parses ISOBMFF-based (such as .mp4) files entirely on the client side, thanks
to various browser APIs like the
[FileReader APIs](https://developer.mozilla.org/en-US/docs/Web/API/FileReader).
As such, it works on any "static" webpage (such as github-pages) without needing
any file to be sent to a web server.

This repo was created mainly because I wanted to have a good overview of
MP4/fragmented MP4 files metadata, mainly DASH and Smooth Streaming
segments/fragments.

This repository contains just the web interface.
The ISOBMFF parser has been isolated to another repository, the
[isobmff-inspector](https://github.com/peaBerberian/isobmff-inspector).



## Parsed boxes ################################################################

The inspector only parses the following ISOBMFF boxes for now:
  - ac-3
  - av01
  - avc1
  - avc3
  - avcC
  - btrt
  - cdsc
  - co64
  - colr
  - cslg
  - ctts
  - dac3
  - data
  - dec3
  - dOps
  - dinf
  - dref
  - ec-3
  - edts
  - elng
  - elst (and sub-boxes)
  - emsg
  - enca
  - encv
  - esds
  - font
  - free
  - frma
  - ftyp
  - hdlr
  - hev1
  - hind
  - hint
  - hmhd
  - hvc1
  - hvcC
  - keys
  - ID32
  - ilst
  - iods
  - leva
  - mdat
  - mdhd
  - mdia
  - mehd
  - meta
  - mfhd
  - mfra
  - mfro
  - minf
  - moof
  - moov
  - mp4a
  - mvex
  - mvhd
  - nmhd
  - Opus
  - padb
  - pasp
  - pdin
  - prft
  - pssh
  - saio
  - saiz
  - sbgp
  - schi
  - schm
  - sdtp
  - senc
  - sgpd
  - sidx
  - sinf
  - skip
  - smhd
  - stbl
  - stco
  - stdp
  - sthd
  - stsc
  - stsd
  - stsh
  - stss
  - stz2
  - stsz
  - stts
  - styp
  - subt
  - tenc
  - tfdt
  - tfhd
  - tfra
  - tkhd
  - traf
  - trak
  - tref
  - trep
  - trex
  - trun
  - udta
  - url 
  - urn 
  - uuid
  - vdep
  - vmhd
  - vplx

I plan to support each one of them but UUIDs (I may add support for some of them
in the future, for example for Smooth Streaming ones).



## Contribute ##################################################################

This repository actually just contain the (very simple) user interface, that
you're welcome to improve.

To help with box parsing, most of the parsing logic is actually in another
repository, the
[isobmff-inspector](https://github.com/peaBerberian/isobmff-inspector).
