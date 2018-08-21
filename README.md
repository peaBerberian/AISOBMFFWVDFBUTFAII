# AISOBMFFWVDFBUTFAII ##########################################################

**A**n **ISOBMFF** **W**eb **V**isualizer **D**one **F**or **B**etter
**U**nderstanding **T**he **F**ormat **A**nd **I**ts **I**ntricacies is a pretty
simple web-based ISOBMFF visualizer.

You can test it [here](https://peaberberian.github.io/AISOBMFFWVDFBUTFAII/).

It parses ISOBMFF-based (such as .mp4) files entirely on the client side, thanks
to various browser APIs like the
[FileReader APIs](https://developer.mozilla.org/en-US/docs/Web/API/FileReader).
As such, it works on any "static" webpage (such as github-pages) without needing
any file to be sent to a web server.

This repo was created mainly because I wanted to have a good overview of
MP4/fragmented MP4 files metadata, mainly DASH and Smooth Streaming
segments/fragments.

This repository contains just a (rough) web interface.
The ISOBMFF parser has been isolated to another repository, the
[isobmff-inspector](https://github.com/peaBerberian/isobmff-inspector).



## Parsed boxes ################################################################

The parser only parses the following ISOBMFF boxes for now:
  - dinf
  - dref
  - edts
  - free
  - ftyp
  - hdlr
  - mdat
  - mdhd
  - mdia
  - mehd
  - mfhd
  - minf
  - moof
  - moov
  - mvex
  - mvhd
  - pdin
  - pssh
  - sdtp
  - sidx
  - skip
  - styp
  - tfdt
  - tfhd
  - tkhd
  - traf
  - trak
  - trex
  - trun
  - url
  - urn
  - vmhd

I plan to support each one of them but UUIDs (I may add support for some of them
in the future, for example for Smooth Streaming ones).



## Contribute ##################################################################

This repository actually just contain the (very simple) user interface, that
you're welcome to improve.

To help with box parsing, most of the parsing logic is actually in another
repository, the
[isobmff-inspector](https://github.com/peaBerberian/isobmff-inspector).
